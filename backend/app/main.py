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
from .weather import get_weather, fetch_current_conditions

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
        star=int(a.get("star") or 3),
        power_w=float(a.get("power_w") or 1400),
        catalog_id=a.get("catalog_id"),
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
            "iseer": 3.55,
            "star": 3,
            "power_w": 1450,
            "catalog_id": "ac_voltas_15_3",
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
        pw = float(appliance.get("power_w") or 0)
        if pw > 0:
            iseer = float(appliance.get("iseer") or 3.5)
            cfg.u_cool_max = (pw / 1000.0) * min(1.35, max(0.7, iseer / 3.5)) * 0.95
        else:
            cfg.u_cool_max = _u_cool_for_tonnage(float(appliance.get("tonnage", 1.5)))
        if appliance.get("kind") in ("heater", "heat_pump"):
            cfg.u_heat_max = max(cfg.u_heat_max, pw / 1000.0 if pw else cfg.u_cool_max)
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
        comfort_pref=getattr(body, "comfort_pref", "comfortable") or "comfortable",
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



# ----- Catalog & ML predict -----
from .catalog import get_catalog_item, list_acs, list_refrigerators, research_refs
from .ml_model import AppliancePhysics, get_predictor
from .models import PredictRequest, PredictResponse


@app.get("/api/catalog")
def api_catalog() -> dict:
    return {
        "acs": list_acs(),
        "refrigerators": list_refrigerators(),
        "research": research_refs(),
    }


@app.get("/api/catalog/{item_id}")
def api_catalog_item(item_id: str) -> dict:
    item = get_catalog_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    return item


def _recommended_setpoint(t_out_avg: float, t_out_max: float, humidity_avg: float | None) -> dict:
    """Weather-aware comfort suggestion (ASHRAE-inspired band shift)."""
    # Hotter outdoors → allow slightly higher indoor target to save energy
    base = 24.0
    if t_out_max >= 38:
        base = 25.5
    elif t_out_max >= 34:
        base = 25.0
    elif t_out_avg <= 26:
        base = 23.5
    t_min = base - 2.0
    t_max = base + 2.0
    if humidity_avg and humidity_avg > 70:
        t_max = min(t_max, 25.0)  # tighter when muggy
    return {
        "t_min": round(t_min, 1),
        "t_max": round(t_max, 1),
        "target": round(base, 1),
        "reason": (
            f"Based on forecast peak {t_out_max:.1f}°C and avg {t_out_avg:.1f}°C"
            + (f", RH~{humidity_avg:.0f}%" if humidity_avg else "")
        ),
    }


@app.post("/api/predict", response_model=PredictResponse)
async def api_predict(
    body: PredictRequest,
    user: dict = Depends(get_current_user),
) -> PredictResponse:
    """ML + physics hybrid: forecast indoor T/RH/energy under MPC or reactive policy."""
    appliance = None
    if body.appliance_id is not None:
        appliance = get_appliance(user["id"], body.appliance_id)
        if not appliance:
            raise HTTPException(status_code=404, detail="Appliance not found")

    cat = get_catalog_item(body.catalog_id) if body.catalog_id else None
    if appliance:
        phys = AppliancePhysics(
            tonnage=float(appliance.get("tonnage", 1.5)),
            star=int(appliance.get("star") or 3),
            iseer=float(appliance.get("iseer") or 3.5),
            power_w=float(appliance.get("power_w") or 1400),
            kind=str(appliance.get("kind") or "ac"),
        )
        t_min, t_max = float(appliance["t_min"]), float(appliance["t_max"])
    else:
        phys = AppliancePhysics(
            tonnage=cat["tonnage"] if cat and "tonnage" in cat else body.tonnage,
            star=int(cat["star"]) if cat else body.star,
            iseer=float(cat["iseer"]) if cat and "iseer" in cat else body.iseer,
            power_w=float(cat["power_w"]) if cat else body.power_w,
            kind=str(cat["kind"]) if cat else body.kind,
        )
        t_min, t_max = body.t_min, body.t_max

    weather = await get_weather(
        settings,
        mode=body.mode,
        use_live=body.use_live_weather,
        lat=body.lat,
        lon=body.lon,
        city=body.city,
        hours=body.hours,
    )
    t_outs = [p.t_out for p in weather.points]
    prices = [p.price for p in weather.points]
    hums = [p.humidity_out for p in weather.points if p.humidity_out is not None]
    rec = _recommended_setpoint(
        sum(t_outs) / len(t_outs),
        max(t_outs),
        sum(hums) / len(hums) if hums else None,
    )
    # Prefer weather-recommended band if client sent defaults
    if body.appliance_id is None and abs(body.t_min - 22) < 0.01 and abs(body.t_max - 26) < 0.01:
        t_min, t_max = rec["t_min"], rec["t_max"]

    pred = get_predictor()
    points = pred.predict_horizon(
        t_outs,
        prices,
        phys,
        t_in0=body.t_in0,
        t_min=t_min,
        t_max=t_max,
        policy=body.policy,
    )
    energy = sum(p["energy_kwh"] for p in points)
    comfort = 100.0 * sum(1 for p in points if p["comfort_ok"]) / max(1, len(points))
    cost = sum(p["energy_kwh"] * p["price"] for p in points)

    return PredictResponse(
        weather_source=weather.source,
        city=weather.city,
        recommended_setpoint=rec,
        research=research_refs()[:3],
        points=points,
        summary={
            "energy_kwh": round(energy, 2),
            "cost_inr": round(cost, 0),
            "comfort_pct": round(comfort, 1),
            "avg_humidity": round(sum(p["humidity_pred"] for p in points) / len(points), 1),
            "star": phys.star,
            "iseer": phys.iseer,
            "power_w": phys.power_w,
            "efficiency_scale": round(phys.efficiency_scale, 3),
            "policy": body.policy,
        },
    )


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



@app.get("/api/weather/current")
async def api_weather_current(
    lat: float | None = None,
    lon: float | None = None,
    city: str | None = None,
) -> dict:
    """Current outdoor conditions for the dashboard weather card."""
    try:
        return await fetch_current_conditions(settings, lat=lat, lon=lon, city=city)
    except Exception as exc:  # noqa: BLE001
        return {
            "source": "synthetic",
            "city": city or settings.default_city,
            "lat": lat if lat is not None else settings.default_lat,
            "lon": lon if lon is not None else settings.default_lon,
            "temp_c": 30.0,
            "humidity": 60.0,
            "condition": "Clouds",
            "rain_mm_h": 0.0,
            "wind_kmh": 8.0,
            "feels_like_c": 31.5,
            "note": f"Synthetic fallback: {exc}",
        }


# ----- Occupancy learning, personalization bandit, forecast bias -----
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from .occupancy_model import OccupancyPredictor
from .personalization import ComfortBandBandit, context_vector
from .forecast_bias import ForecastBiasCorrector

_occupancy = OccupancyPredictor()
_bandit = ComfortBandBandit()
_bias = ForecastBiasCorrector()


class OccupancyObserve(BaseModel):
    timestamp: str | None = None
    occupied: bool
    is_holiday: bool = False


class ComfortBandOverride(BaseModel):
    t_min: float
    t_max: float
    h_min: float = 40.0
    h_max: float = 60.0
    hour: float | None = None
    outdoor_temp: float = 30.0
    outdoor_humidity: float = 60.0
    day_of_week: int | None = None


@app.post("/api/occupancy/observe")
def api_occupancy_observe(body: OccupancyObserve) -> dict:
    ts = datetime.fromisoformat(body.timestamp) if body.timestamp else datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    _occupancy.observe(ts, body.occupied, body.is_holiday)
    return {
        "ok": True,
        "n_obs": len(_occupancy.observations),
        "n_days": _occupancy._n_unique_days(),
        "proba_now": _occupancy.predict_proba(ts, body.is_holiday),
    }


@app.get("/api/occupancy/schedule")
def api_occupancy_schedule(hours: int = Query(48, ge=24, le=168)) -> dict:
    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    proba = _occupancy.predict_schedule(start, hours=hours)
    return {
        "start": start.isoformat(),
        "hours": hours,
        "p_occupied": [round(float(p), 3) for p in proba],
        "using_prior": _occupancy._n_unique_days() < _occupancy.min_days,
    }


@app.post("/api/comfort-band")
def api_set_comfort_band(body: ComfortBandOverride) -> dict:
    now = datetime.now(timezone.utc)
    hour = body.hour if body.hour is not None else now.hour + now.minute / 60.0
    dow = body.day_of_week if body.day_of_week is not None else now.weekday()
    ctx = context_vector(hour, body.outdoor_temp, body.outdoor_humidity, dow)
    _bandit.update(ctx, (body.t_min, body.t_max, body.h_min, body.h_max))
    band, conf = _bandit.suggest(ctx)
    return {
        "ok": True,
        "n_updates": _bandit.n_updates,
        "suggested": {
            "t_min": band[0],
            "t_max": band[1],
            "h_min": band[2],
            "h_max": band[3],
        },
        "confidence": conf,
    }


@app.get("/api/personalization")
def api_personalization(
    outdoor_temp: float = Query(30.0),
    outdoor_humidity: float = Query(60.0),
) -> dict:
    now = datetime.now(timezone.utc)
    ctx = context_vector(now.hour + now.minute / 60.0, outdoor_temp, outdoor_humidity, now.weekday())
    band, conf = _bandit.suggest(ctx)
    return {
        "suggested_t_min": band[0],
        "suggested_t_max": band[1],
        "suggested_h_min": band[2],
        "suggested_h_max": band[3],
        "confidence": conf,
        "n_overrides": _bandit.n_updates,
    }


@app.get("/api/forecast-bias")
def api_forecast_bias() -> dict:
    return {"buckets": _bias.snapshot()}


@app.post("/api/forecast-bias/observe")
def api_forecast_bias_observe(
    lead_time_hours: float = Query(..., ge=0, le=48),
    forecast_value: float = Query(...),
    actual_value: float = Query(...),
    var: str = Query("temp", pattern="^(temp|humidity)$"),
) -> dict:
    _bias.observe(lead_time_hours, forecast_value, actual_value, var=var)
    return {"ok": True, "buckets": _bias.snapshot()}

