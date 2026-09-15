"""ThermoLogic API — weather, simulation, calculator, auth."""

from __future__ import annotations

import copy

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from .calculator import compute_savings
from .config import get_settings
from .database import create_user, get_user_by_email, init_db
from .models import (
    ActuationRequest,
    ActuationResponse,
    AuthResponse,
    CalculatorRequest,
    CalculatorResponse,
    HealthResponse,
    LoginRequest,
    SignupRequest,
    SimRequest,
    SimResponse,
    UserOut,
    WeatherResponse,
)
from .reference_data import REFERENCE
from .simulator import run_simulation
from .weather import get_weather, synthetic_weather

settings = get_settings()

app = FastAPI(
    title="ThermoLogic API",
    description="Forecast-aware thermostat backend with auth, calculator, and simulation.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        use_live_weather=settings.use_live_weather,
        actuation_enabled=settings.actuation_enabled,
        has_weather_key=bool(settings.openweather_api_key),
        city=settings.default_city,
    )


@app.get("/api/reference")
def api_reference() -> dict:
    """Static data backing website claims (savings ranges, BEE, CEA, tariffs)."""
    return REFERENCE


# ----- Auth -----
@app.post("/api/auth/signup", response_model=AuthResponse)
def signup(body: SignupRequest) -> AuthResponse:
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if get_user_by_email(email):
        raise HTTPException(status_code=400, detail="Email already registered")
    try:
        user = create_user(email, body.name, hash_password(body.password))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not create user: {exc}") from exc
    token = create_access_token(user["id"], user["email"])
    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user.get("created_at"),
        ),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(user["id"], user["email"])
    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user.get("created_at"),
        ),
    )


from .auth import get_current_user as _get_current_user

@app.get("/api/auth/me", response_model=UserOut)
def auth_me(user: dict = Depends(_get_current_user)) -> UserOut:
    return UserOut(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user.get("created_at"),
    )


# ----- Weather & simulate -----
@app.get("/api/weather", response_model=WeatherResponse)
async def api_weather(
    mode: str = Query("heatwave", pattern="^(heatwave|smooth)$"),
    live: bool | None = Query(None),
    lat: float | None = None,
    lon: float | None = None,
    city: str | None = None,
    hours: int = Query(168, ge=24, le=336),
) -> WeatherResponse:
    return await get_weather(
        settings, mode=mode, use_live=live, lat=lat, lon=lon, city=city, hours=hours
    )


@app.post("/api/simulate", response_model=SimResponse)
async def api_simulate(body: SimRequest) -> SimResponse:
    t_min = body.t_min if body.t_min is not None else settings.t_min
    t_max = body.t_max if body.t_max is not None else settings.t_max
    if t_min >= t_max:
        raise HTTPException(status_code=400, detail="t_min must be < t_max")

    cfg = copy.copy(settings)
    if body.r_thermal is not None:
        cfg.r_thermal = body.r_thermal
    if body.c_thermal is not None:
        cfg.c_thermal = body.c_thermal
    if body.u_cool_max is not None:
        cfg.u_cool_max = body.u_cool_max
    if body.price_offpeak is not None:
        cfg.price_offpeak = body.price_offpeak
    if body.price_peak is not None:
        cfg.price_peak = body.price_peak

    weather = await get_weather(
        cfg,
        mode=body.mode,
        use_live=body.use_live_weather,
        lat=body.lat,
        lon=body.lon,
        city=body.city,
        hours=body.hours,
    )

    # Re-price weather points if user overrode tariffs
    if body.price_offpeak is not None or body.price_peak is not None:
        for p in weather.points:
            hod = p.hour % 24
            p.price = (
                cfg.price_peak
                if cfg.peak_start_hour <= hod <= cfg.peak_end_hour
                else cfg.price_offpeak
            )

    result = run_simulation(
        cfg,
        weather.points,
        t_min=t_min,
        t_max=t_max,
        away=body.away,
        comfort_nudge=body.comfort_nudge,
        city=weather.city,
        weather_source=weather.source,
    )
    result.parameters_used = {
        "r_thermal": cfg.r_thermal,
        "c_thermal": cfg.c_thermal,
        "u_cool_max": cfg.u_cool_max,
        "price_offpeak": cfg.price_offpeak,
        "price_peak": cfg.price_peak,
        "t_min": t_min,
        "t_max": t_max,
        "mode": body.mode,
        "away": body.away,
        "hours": body.hours,
    }
    return result


@app.post("/api/calculator", response_model=CalculatorResponse)
def api_calculator(body: CalculatorRequest) -> CalculatorResponse:
    """Annual energy / ₹ / CO₂ savings from user-tunable household parameters."""
    return compute_savings(body)


@app.post("/api/actuate", response_model=ActuationResponse)
def api_actuate(body: ActuationRequest) -> ActuationResponse:
    if not settings.actuation_enabled:
        return ActuationResponse(
            accepted=False,
            message="Actuation disabled (ACTUATION_ENABLED=false). Simulation-only mode.",
            command=None,
        )
    return ActuationResponse(
        accepted=True,
        message=f"Command '{body.command}' at {body.power_kw} kW accepted (demo stub).",
        command=body.command,
    )


@app.get("/api/impact")
def api_impact() -> dict:
    s = REFERENCE["savings"]
    g = REFERENCE["grid"]
    return {
        "savings_pct_range": s["pct_range"],
        "annual_savings_inr": s["annual_inr_range"],
        "per_household_note": (
            "Based on ~900–1,800 kWh/yr cooling (BEE-style hours) and DISCOM tariffs ~₹6–9/kWh."
        ),
        "city_scale_mwh": s["city_mwh_range"],
        "city_scale_note": "Illustrative mid-size metro residential AC stock.",
        "co2_tons": s["co2_tons_range"],
        "co2_note": f"Grid intensity ≈ {g['emission_factor_tco2_per_mwh']} tCO₂/MWh — {g['source']}.",
        "sources": REFERENCE["sources"],
        "ac_presets": REFERENCE["ac_presets"],
        "tariffs": REFERENCE["tariffs"],
        "bee": REFERENCE["bee"],
    }
