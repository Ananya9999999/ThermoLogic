"""Request/response schemas shared with the frontend."""

from typing import Literal, Optional
from pydantic import BaseModel, Field


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
    t_min: Optional[float] = None
    t_max: Optional[float] = None


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


class HealthResponse(BaseModel):
    status: str
    use_live_weather: bool
    actuation_enabled: bool
    has_weather_key: bool
    city: str


class ActuationRequest(BaseModel):
    """Gated: only accepted when ACTUATION_ENABLED=true."""
    command: Literal["idle", "cool", "heat"]
    power_kw: float = Field(0.0, ge=0.0, le=5.0)


class ActuationResponse(BaseModel):
    accepted: bool
    message: str
    command: Optional[str] = None
