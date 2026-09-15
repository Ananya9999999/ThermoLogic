"""Server configuration from environment. Secrets never leave the process."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openweather_api_key: str = ""
    default_city: str = "Bengaluru"
    default_lat: float = 12.9716
    default_lon: float = 77.5946

    use_live_weather: bool = False
    actuation_enabled: bool = False

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    host: str = "0.0.0.0"
    port: int = 8000

    # Building defaults (Indian apartment-ish lumped RC)
    r_thermal: float = 2.5  # °C/kW effective
    c_thermal: float = 8.0  # kWh/°C
    u_cool_max: float = 3.5  # kW
    u_heat_max: float = 2.0  # kW
    t_min: float = 22.0
    t_max: float = 26.0
    t_in0: float = 24.0
    dt_hours: float = 1.0

    # Illustrative ToU tariff ₹/kWh
    price_offpeak: float = 4.2
    price_peak: float = 8.5
    peak_start_hour: int = 10
    peak_end_hour: int = 18

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
