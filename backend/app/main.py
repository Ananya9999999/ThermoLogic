"""
ThermoLogic API

- Weather proxy (OpenWeatherMap key stays on server)
- Synthetic fallback for offline demos
- Fair baseline vs planning simulation
- Actuation endpoint gated by ACTUATION_ENABLED
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .models import (
    ActuationRequest,
    ActuationResponse,
    HealthResponse,
    SimRequest,
    SimResponse,
    WeatherResponse,
)
from .simulator import run_simulation
from .weather import get_weather

settings = get_settings()

app = FastAPI(
    title="ThermoLogic API",
    description="Forecast-aware thermostat backend: weather proxy, simulation, gated actuation.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        use_live_weather=settings.use_live_weather,
        actuation_enabled=settings.actuation_enabled,
        has_weather_key=bool(settings.openweather_api_key),
        city=settings.default_city,
    )


@app.get("/api/weather", response_model=WeatherResponse)
async def api_weather(
    mode: str = Query("heatwave", pattern="^(heatwave|smooth)$"),
    live: bool | None = Query(None, description="Override USE_LIVE_WEATHER"),
    lat: float | None = None,
    lon: float | None = None,
    city: str | None = None,
    hours: int = Query(168, ge=24, le=336),
) -> WeatherResponse:
    """Outdoor temperature (+ RH) and ToU price trace. Live calls are server-side only."""
    return await get_weather(
        settings,
        mode=mode,
        use_live=live,
        lat=lat,
        lon=lon,
        city=city,
        hours=hours,
    )


@app.post("/api/simulate", response_model=SimResponse)
async def api_simulate(body: SimRequest) -> SimResponse:
    """
    Run baseline deadband thermostat vs planning controller on the same weather.
    """
    t_min = body.t_min if body.t_min is not None else settings.t_min
    t_max = body.t_max if body.t_max is not None else settings.t_max
    if t_min >= t_max:
        raise HTTPException(status_code=400, detail="t_min must be < t_max")

    weather = await get_weather(
        settings,
        mode=body.mode,
        use_live=body.use_live_weather,
        lat=body.lat,
        lon=body.lon,
        city=body.city,
        hours=body.hours,
    )

    return run_simulation(
        settings,
        weather.points,
        t_min=t_min,
        t_max=t_max,
        away=body.away,
        comfort_nudge=body.comfort_nudge,
        city=weather.city,
        weather_source=weather.source,
    )


@app.post("/api/actuate", response_model=ActuationResponse)
def api_actuate(body: ActuationRequest) -> ActuationResponse:
    """
    Hardware command path — disabled unless ACTUATION_ENABLED=true.
    Even when enabled, power is clamped by the schema (max 5 kW).
    """
    if not settings.actuation_enabled:
        return ActuationResponse(
            accepted=False,
            message="Actuation disabled (ACTUATION_ENABLED=false). Simulation-only mode.",
            command=None,
        )
    # Placeholder: in production, send to device bridge with auth + rate limits
    return ActuationResponse(
        accepted=True,
        message=f"Command '{body.command}' at {body.power_kw} kW accepted (demo stub).",
        command=body.command,
    )


@app.get("/api/impact")
def api_impact() -> dict:
    """Static impact factors grounded in public BEE / CEA-style assumptions."""
    return {
        "savings_pct_range": "13–20%",
        "annual_savings_inr": "₹1,200 – ₹4,800",
        "per_household_note": (
            "Based on ~900–1,800 kWh/yr cooling (BEE ~1,600 h label hours, "
            "adjusted for real runtime) and DISCOM tariffs roughly ₹6–9/kWh."
        ),
        "city_scale_mwh": "30,000 – 70,000 MWh / year",
        "city_scale_note": "Illustrative mid-size metro (~300k–500k residential AC households).",
        "co2_tons": "21,000 – 50,000 tCO₂ / year",
        "co2_note": (
            "Using CEA Indian grid weighted-average emission factor ≈ 0.71 tCO₂/MWh "
            "(FY 2024–25 order of magnitude)."
        ),
        "sources": [
            "BEE ISEER / annual units methodology (~1,600 h/year reference)",
            "CEA CO₂ Baseline Database (grid emission factor)",
            "State DISCOM tariff orders (ToU / slab illustrative averages)",
        ],
    }
