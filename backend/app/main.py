"""ThermoLogic API — auth, appliances, weather, simulation, calculator, live dashboard."""

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
from .database import (
    create_appliance,
    create_user,
    delete_appliance,
    get_appliance,
    get_user_by_email,
    init_db,
    list_appliances,
    update_appliance,
)
from .models import (
    ActuationRequest,
    ActuationResponse,
    ApplianceCreate,
    ApplianceOut,
    ApplianceUpdate,
    AuthResponse,
    CalculatorRequest,
    CalculatorResponse,
    DashboardResponse,
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
from .weather import get_weather

settings = get_settings()

app = FastAPI(
    title="ThermoLogic API",
    description="Multi-appliance thermostat backend with auth and live dashboard.",
    version="0.3.0",
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


def _user_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"], email=u["email"], name=u["name"], created_at=u.get("created_at")
    )


def _appliance_out(a: dict) -> ApplianceOut:
    return ApplianceOut(
        id=a["id"],
        user_id=a["user_id"],
        name=a["name"],
        kind=a["kind"],
        room=a["room"],
        tonnage=a["tonnage"],
        iseer=a["iseer"],
        t_min=a["t_min"],
        t_max=a["t_max"],
        enabled=a["enabled"],
        meta=a.get("meta") or {},
        created_at=a.get("created_at"),
    )


def _u_cool_for_tonnage(tonnage: float) -> float:
    return max(1.0, min(8.0, tonnage * 3.5 * 0.65))


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
    return REFERENCE


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
        "appliance_kinds": [
            {"id": "ac", "label": "Split / window AC"},
            {"id": "heater", "label": "Room heater"},
            {"id": "heat_pump", "label": "Heat pump"},
            {"id": "fan_coil", "label": "Fan coil unit"},
        ],
    }


# ----- Auth -----
@app.post("/api/auth/signup", response_model=AuthResponse)
def signup(body: SignupRequest) -> AuthResponse:
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if get_user_by_email(email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = create_user(email, body.name, hash_password(body.password))
    # Seed one default AC so dashboard is never empty
    create_appliance(
        user["id"],
        {
            "name": "Main AC",
            "kind": "ac",
            "room": "Living room",
            "tonnage": 1.5,
            "iseer": 3.8,
            "t_min": 22,
            "t_max": 26,
        },
    )
    token = create_access_token(user["id"], user["email"])
    return AuthResponse(access_token=token, user=_user_out(user))


@app.post("/api/auth/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(user["id"], user["email"])
    return AuthResponse(access_token=token, user=_user_out(user))


@app.get("/api/auth/me", response_model=UserOut)
def auth_me(user: dict = Depends(get_current_user)) -> UserOut:
    return _user_out(user)


# ----- Appliances -----
@app.get("/api/appliances", response_model=list[ApplianceOut])
def api_list_appliances(user: dict = Depends(get_current_user)) -> list[ApplianceOut]:
    return [_appliance_out(a) for a in list_appliances(user["id"])]


@app.post("/api/appliances", response_model=ApplianceOut)
def api_create_appliance(
    body: ApplianceCreate, user: dict = Depends(get_current_user)
) -> ApplianceOut:
    a = create_appliance(user["id"], body.model_dump())
    return _appliance_out(a)


@app.patch("/api/appliances/{appliance_id}", response_model=ApplianceOut)
def api_update_appliance(
    appliance_id: int,
    body: ApplianceUpdate,
    user: dict = Depends(get_current_user),
) -> ApplianceOut:
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    a = update_appliance(user["id"], appliance_id, data)
    if not a:
        raise HTTPException(status_code=404, detail="Appliance not found")
    return _appliance_out(a)


@app.delete("/api/appliances/{appliance_id}")
def api_delete_appliance(
    appliance_id: int, user: dict = Depends(get_current_user)
) -> dict:
    if not delete_appliance(user["id"], appliance_id):
        raise HTTPException(status_code=404, detail="Appliance not found")
    return {"ok": True}


# ----- Weather / simulate / calculator -----
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


async def _run_sim_for(
    body: SimRequest,
    appliance: dict | None = None,
) -> SimResponse:
    t_min = body.t_min if body.t_min is not None else settings.t_min
    t_max = body.t_max if body.t_max is not None else settings.t_max
    if appliance:
        t_min = appliance.get("t_min", t_min)
        t_max = appliance.get("t_max", t_max)

    if t_min >= t_max:
        raise HTTPException(status_code=400, detail="t_min must be < t_max")

    cfg = copy.copy(settings)
    if body.r_thermal is not None:
        cfg.r_thermal = body.r_thermal
    if body.c_thermal is not None:
        cfg.c_thermal = body.c_thermal
    if body.u_cool_max is not None:
        cfg.u_cool_max = body.u_cool_max
    elif body.tonnage is not None:
        cfg.u_cool_max = _u_cool_for_tonnage(body.tonnage)
    elif appliance:
        cfg.u_cool_max = _u_cool_for_tonnage(float(appliance.get("tonnage", 1.5)))
        if appliance.get("kind") == "heater":
            cfg.u_heat_max = max(cfg.u_heat_max, cfg.u_cool_max)
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
    if appliance:
        result.appliance = {
            "id": appliance["id"],
            "name": appliance["name"],
            "kind": appliance["kind"],
            "room": appliance["room"],
            "tonnage": appliance["tonnage"],
        }
    return result


@app.post("/api/simulate", response_model=SimResponse)
async def api_simulate(
    body: SimRequest,
    user: dict | None = Depends(get_current_user),
) -> SimResponse:
    appliance = None
    if body.appliance_id is not None:
        appliance = get_appliance(user["id"], body.appliance_id)
        if not appliance:
            raise HTTPException(status_code=404, detail="Appliance not found")
    return await _run_sim_for(body, appliance)


@app.get("/api/dashboard", response_model=DashboardResponse)
async def api_dashboard(
    mode: str = Query("heatwave", pattern="^(heatwave|smooth)$"),
    hours: int = Query(48, ge=24, le=168),
    user: dict = Depends(get_current_user),
) -> DashboardResponse:
    """Live multi-appliance dashboard: run sim for each enabled device."""
    apps = list_appliances(user["id"])
    simulations: list[dict] = []
    total_base = total_mpc = total_cost_base = total_cost_mpc = 0.0

    for a in apps:
        if not a.get("enabled", True):
            continue
        body = SimRequest(
            mode=mode,  # type: ignore[arg-type]
            hours=hours,
            appliance_id=a["id"],
            tonnage=a["tonnage"],
            t_min=a["t_min"],
            t_max=a["t_max"],
        )
        sim = await _run_sim_for(body, a)
        m = sim.metrics
        total_base += m.energy_base_kwh
        total_mpc += m.energy_mpc_kwh
        total_cost_base += m.cost_base_inr
        total_cost_mpc += m.cost_mpc_inr
        simulations.append(
            {
                "appliance": sim.appliance,
                "metrics": m.model_dump(),
                "points": [p.model_dump() for p in sim.points],
                "t_min": sim.t_min,
                "t_max": sim.t_max,
            }
        )

    savings_pct = (
        ((total_base - total_mpc) / total_base * 100.0) if total_base > 1e-6 else 0.0
    )
    return DashboardResponse(
        user=_user_out(user),
        appliances=[_appliance_out(a) for a in apps],
        aggregate={
            "energy_base_kwh": round(total_base, 2),
            "energy_mpc_kwh": round(total_mpc, 2),
            "savings_pct": round(savings_pct, 1),
            "cost_base_inr": round(total_cost_base, 0),
            "cost_mpc_inr": round(total_cost_mpc, 0),
            "saved_inr": round(total_cost_base - total_cost_mpc, 0),
            "appliance_count": len([a for a in apps if a.get("enabled", True)]),
            "mode": mode,
            "hours": hours,
        },
        simulations=simulations,
    )


@app.post("/api/calculator", response_model=CalculatorResponse)
def api_calculator(body: CalculatorRequest) -> CalculatorResponse:
    return compute_savings(body)


@app.post("/api/actuate", response_model=ActuationResponse)
def api_actuate(body: ActuationRequest) -> ActuationResponse:
    if not settings.actuation_enabled:
        return ActuationResponse(
            accepted=False,
            message="Actuation disabled. Simulation-only mode.",
            command=None,
        )
    return ActuationResponse(
        accepted=True,
        message=f"Command '{body.command}' at {body.power_kw} kW accepted.",
        command=body.command,
    )
