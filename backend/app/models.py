"""Request/response schemas."""

from typing import Any, Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class WeatherPoint(BaseModel):
    hour: int
    t_out: float
    humidity_out: Optional[float] = None
    price: float


class WeatherResponse(BaseModel):
    source: Literal["live", "synthetic"]
    city: str
    lat: float
    lon: float
    fetched_at: Optional[str] = None
    points: list[WeatherPoint]
    note: str = ""


class SimRequest(BaseModel):
    mode: Literal["heatwave", "smooth"] = "heatwave"
    use_live_weather: Optional[bool] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    city: Optional[str] = None
    away: bool = False
    comfort_nudge: int = Field(0, ge=-2, le=2)
    hours: int = Field(168, ge=24, le=336)
    t_min: Optional[float] = Field(None, ge=16, le=28)
    t_max: Optional[float] = Field(None, ge=20, le=32)
    # Building parameters (user-tunable)
    r_thermal: Optional[float] = Field(None, ge=0.5, le=10)
    c_thermal: Optional[float] = Field(None, ge=1, le=30)
    u_cool_max: Optional[float] = Field(None, ge=0.5, le=8)
    price_offpeak: Optional[float] = Field(None, ge=1, le=20)
    price_peak: Optional[float] = Field(None, ge=1, le=30)


class TrajectoryPoint(BaseModel):
    hour: int
    t_out: float
    t_in_baseline: float
    t_in_mpc: float
    u_baseline: float
    u_mpc: float
    humidity_baseline: float
    humidity_mpc: float
    price: float


class SimMetrics(BaseModel):
    energy_base_kwh: float
    energy_mpc_kwh: float
    savings_pct: float
    comfort_base_pct: float
    comfort_mpc_pct: float
    avg_hum_base: float
    avg_hum_mpc: float
    cost_base_inr: float
    cost_mpc_inr: float


class SimResponse(BaseModel):
    weather_source: Literal["live", "synthetic"]
    city: str
    t_min: float
    t_max: float
    away: bool
    metrics: SimMetrics
    points: list[TrajectoryPoint]
    demo_script: list[str]
    parameters_used: dict[str, Any] = {}


class HealthResponse(BaseModel):
    status: str
    use_live_weather: bool
    actuation_enabled: bool
    has_weather_key: bool
    city: str


class ActuationRequest(BaseModel):
    command: Literal["idle", "cool", "heat"]
    power_kw: float = Field(0.0, ge=0.0, le=5.0)


class ActuationResponse(BaseModel):
    accepted: bool
    message: str
    command: Optional[str] = None


# --- Auth ---
class SignupRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120)
    name: str = Field(..., min_length=1, max_length=80)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Calculator ---
class CalculatorRequest(BaseModel):
    tonnage: float = Field(1.5, ge=0.75, le=3.0)
    iseer: float = Field(3.8, ge=2.5, le=6.0)
    hours_per_day: float = Field(6.0, ge=1, le=16)
    days_per_year: int = Field(200, ge=60, le=365)
    tariff_inr_per_kwh: float = Field(7.0, ge=3, le=15)
    savings_pct: float = Field(15.0, ge=5, le=30)
    peak_share_pct: float = Field(40.0, ge=0, le=80)
    grid_ef_tco2_per_mwh: float = Field(0.71, ge=0.4, le=1.2)


class CalculatorResponse(BaseModel):
    baseline_kwh_year: float
    mpc_kwh_year: float
    saved_kwh_year: float
    baseline_cost_inr: float
    mpc_cost_inr: float
    saved_inr_year: float
    co2_tons_year: float
    assumptions: dict[str, Any]
