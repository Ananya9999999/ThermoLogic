"""Outdoor temperature traces: Open-Meteo (no key), optional OpenWeatherMap, synthetic."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

import httpx

from .config import Settings
from .models import WeatherPoint, WeatherResponse


def _price_for_hour(hod: int, settings: Settings) -> float:
    if settings.peak_start_hour <= hod <= settings.peak_end_hour:
        return settings.price_peak
    return settings.price_offpeak


def synthetic_weather(
    settings: Settings,
    mode: str = "heatwave",
    hours: int = 168,
    city: Optional[str] = None,
) -> WeatherResponse:
    points: list[WeatherPoint] = []
    for k in range(hours):
        day = k // 24
        hod = k % 24
        t_out = 28.0 + 6.0 * math.sin(((hod - 6) / 24.0) * 2.0 * math.pi)
        if mode == "heatwave" and 3 <= day <= 4:
            t_out += 8.0 + 3.0 * math.sin(((hod - 14) / 24.0) * math.pi)
        rh = 55.0 + 10.0 * math.sin(((hod - 4) / 24.0) * 2.0 * math.pi)
        if mode == "heatwave" and 3 <= day <= 4:
            rh += 5.0
        points.append(
            WeatherPoint(
                hour=k,
                t_out=round(t_out, 1),
                humidity_out=round(max(35.0, min(85.0, rh)), 1),
                price=_price_for_hour(hod, settings),
            )
        )
    return WeatherResponse(
        source="synthetic",
        city=city or settings.default_city,
        lat=settings.default_lat,
        lon=settings.default_lon,
        fetched_at=None,
        points=points,
        note=f"Synthetic {mode} profile — offline fallback.",
    )


async def _geocode_city(city: str) -> tuple[float, float, str]:
    url = "https://geocoding-api.open-meteo.com/v1/search"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, params={"name": city, "count": 1, "language": "en", "format": "json"})
        r.raise_for_status()
        data = r.json()
    results = data.get("results") or []
    if not results:
        raise RuntimeError(f"City not found: {city}")
    p = results[0]
    label = ", ".join(x for x in [p.get("name"), p.get("admin1"), p.get("country_code")] if x)
    return float(p["latitude"]), float(p["longitude"]), label


async def fetch_open_meteo(
    settings: Settings,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
    hours: int = 48,
) -> WeatherResponse:
    """Hourly forecast from Open-Meteo — no API key required."""
    city_name = city or settings.default_city
    if lat is None or lon is None:
        if city:
            lat, lon, city_name = await _geocode_city(city)
        else:
            lat = settings.default_lat
            lon = settings.default_lon
            city_name = settings.default_city

    # Request enough hourly steps
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m",
        "forecast_days": min(7, max(1, (hours + 23) // 24)),
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    hourly = data.get("hourly") or {}
    temps = hourly.get("temperature_2m") or []
    hums = hourly.get("relative_humidity_2m") or []
    if not temps:
        raise RuntimeError("Open-Meteo returned no hourly temperatures")

    points: list[WeatherPoint] = []
    n = min(hours, len(temps))
    for k in range(n):
        hod = k % 24
        t = float(temps[k])
        rh = float(hums[k]) if k < len(hums) and hums[k] is not None else 55.0
        points.append(
            WeatherPoint(
                hour=k,
                t_out=round(t, 1),
                humidity_out=round(rh, 1),
                price=_price_for_hour(hod, settings),
            )
        )

    return WeatherResponse(
        source="live",
        city=city_name,
        lat=float(lat),
        lon=float(lon),
        fetched_at=datetime.now(timezone.utc).isoformat(),
        points=points,
        note="Live Open-Meteo hourly forecast (no API key).",
    )


async def fetch_live_weather(
    settings: Settings,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
    hours: int = 48,
) -> WeatherResponse:
    """Prefer OpenWeatherMap if key set; otherwise Open-Meteo."""
    if settings.openweather_api_key:
        try:
            return await fetch_openweather(settings, lat, lon, city, hours)
        except Exception:
            pass  # fall through to Open-Meteo
    return await fetch_open_meteo(settings, lat, lon, city, hours)


async def fetch_openweather(
    settings: Settings,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
    hours: int = 48,
) -> WeatherResponse:
    if not settings.openweather_api_key:
        raise RuntimeError("OPENWEATHER_API_KEY is not set")

    lat = lat if lat is not None else settings.default_lat
    lon = lon if lon is not None else settings.default_lon
    city_name = city or settings.default_city

    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.openweather_api_key,
        "units": "metric",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    raw: list[tuple[float, float]] = []
    for item in data.get("list", []):
        t = float(item["main"]["temp"])
        rh = float(item["main"].get("humidity", 50))
        raw.append((t, rh))
    if not raw:
        raise RuntimeError("OpenWeatherMap returned no forecast points")

    points: list[WeatherPoint] = []
    expanded_t: list[float] = []
    expanded_rh: list[float] = []
    for i, (t, rh) in enumerate(raw):
        expanded_t.append(t)
        expanded_rh.append(rh)
        if i + 1 < len(raw):
            t2, rh2 = raw[i + 1]
            for j in range(1, 3):
                f = j / 3.0
                expanded_t.append(t + (t2 - t) * f)
                expanded_rh.append(rh + (rh2 - rh) * f)

    for k in range(min(hours, len(expanded_t))):
        hod = k % 24
        points.append(
            WeatherPoint(
                hour=k,
                t_out=round(expanded_t[k], 1),
                humidity_out=round(expanded_rh[k], 1),
                price=_price_for_hour(hod, settings),
            )
        )

    return WeatherResponse(
        source="live",
        city=city_name,
        lat=float(lat),
        lon=float(lon),
        fetched_at=datetime.now(timezone.utc).isoformat(),
        points=points,
        note="Live OpenWeatherMap forecast (proxied server-side).",
    )


async def get_weather(
    settings: Settings,
    mode: str = "heatwave",
    use_live: Optional[bool] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
    hours: int = 168,
) -> WeatherResponse:
    live = settings.use_live_weather if use_live is None else use_live
    if live:
        try:
            return await fetch_live_weather(settings, lat, lon, city, hours=min(hours, 120))
        except Exception as exc:  # noqa: BLE001
            synth = synthetic_weather(settings, mode=mode, hours=hours, city=city)
            synth.note = f"Live weather failed ({exc}); using synthetic fallback."
            return synth
    return synthetic_weather(settings, mode=mode, hours=hours, city=city)


def generate_occupancy_schedule(
    hours: int = 168,
    dt_hours: float = 1.0,
    work_start: int = 9,
    work_end: int = 18,
) -> list[bool]:
    n = int(hours / dt_hours) if dt_hours else hours
    out: list[bool] = []
    for k in range(n):
        hod = int((k * dt_hours) % 24)
        day = int((k * dt_hours) // 24) % 7
        is_weekend = day >= 5
        if is_weekend:
            out.append(True)
        else:
            out.append(not (work_start <= hod < work_end))
    return out


async def fetch_current_conditions(
    settings: Settings,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
) -> dict:
    """Current outdoor conditions — Open-Meteo first, no key required."""
    try:
        if lat is None or lon is None:
            if city:
                lat, lon, city_label = await _geocode_city(city)
            else:
                lat, lon, city_label = settings.default_lat, settings.default_lon, settings.default_city
        else:
            city_label = city or settings.default_city

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
            "wind_speed_unit": "kmh",
            "timezone": "auto",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        c = data.get("current") or {}
        return {
            "source": "open-meteo",
            "city": city_label,
            "lat": lat,
            "lon": lon,
            "temp_c": round(float(c.get("temperature_2m", 28)), 1),
            "feels_like_c": round(float(c.get("apparent_temperature", c.get("temperature_2m", 28))), 1),
            "humidity": round(float(c.get("relative_humidity_2m", 60))),
            "wind_kmh": round(float(c.get("wind_speed_10m", 0)), 1),
            "precipitation": round(float(c.get("precipitation", 0)), 1),
            "weather_code": int(c.get("weather_code", 2)),
        }
    except Exception as exc:  # noqa: BLE001
        hod = datetime.now().hour
        t = 28.0 + 6.0 * math.sin(((hod - 6) / 24.0) * 2.0 * math.pi)
        return {
            "source": "synthetic",
            "city": city or settings.default_city,
            "lat": lat if lat is not None else settings.default_lat,
            "lon": lon if lon is not None else settings.default_lon,
            "temp_c": round(t, 1),
            "feels_like_c": round(t + 1.5, 1),
            "humidity": 60,
            "wind_kmh": 8.0,
            "precipitation": 0.0,
            "weather_code": 2,
            "note": f"Fallback synthetic ({exc})",
        }
