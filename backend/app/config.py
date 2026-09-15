"""Server configuration from environment."""

from __future__ import annotations

import os
from functools import lru_cache
from dataclasses import dataclass
from pathlib import Path

# Load backend/.env if present
try:
    from dotenv import load_dotenv

    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)
except ImportError:
    pass


def _bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass
class Settings:
    openweather_api_key: str = ""
    default_city: str = "Bengaluru"
    default_lat: float = 12.9716
    default_lon: float = 77.5946
    use_live_weather: bool = False
    actuation_enabled: bool = False
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    host: str = "0.0.0.0"
    port: int = 8000
    jwt_secret: str = "thermologic-hackathon-change-me-in-production"
    jwt_expire_hours: int = 72
    database_path: str = "thermologic.db"
    r_thermal: float = 2.5
    c_thermal: float = 8.0
    u_cool_max: float = 3.5
    u_heat_max: float = 2.0
    t_min: float = 22.0
    t_max: float = 26.0
    t_in0: float = 24.0
    dt_hours: float = 1.0
    price_offpeak: float = 4.2
    price_peak: float = 8.5
    peak_start_hour: int = 10
    peak_end_hour: int = 18

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings(
        openweather_api_key=os.getenv("OPENWEATHER_API_KEY", ""),
        default_city=os.getenv("DEFAULT_CITY", "Bengaluru"),
        default_lat=_float("DEFAULT_LAT", 12.9716),
        default_lon=_float("DEFAULT_LON", 77.5946),
        use_live_weather=_bool("USE_LIVE_WEATHER", False),
        actuation_enabled=_bool("ACTUATION_ENABLED", False),
        cors_origins=os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ),
        jwt_secret=os.getenv(
            "JWT_SECRET", "thermologic-hackathon-change-me-in-production"
        ),
        jwt_expire_hours=_int("JWT_EXPIRE_HOURS", 72),
        database_path=os.getenv("DATABASE_PATH", "thermologic.db"),
    )
