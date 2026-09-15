"""Weather: live OpenWeatherMap behind the server, or synthetic generator."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

import httpx

from .config import Settings
from .models import WeatherPoint, WeatherResponse


def _price_for_hour(hour_of_day: int, settings: Settings) -> float:
    if settings.peak_start_hour <= hour_of_day <= settings.peak_end_hour:
        return settings.price_peak
    return settings.price_offpeak


def synthetic_weather(
    settings: Settings,
    mode: str = "heatwave",
    hours: int = 168,
    city: Optional[str] = None,
) -> WeatherResponse:
    """Deterministic outdoor trace matching the frontend mock narrative."""
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
        note=f"Synthetic {mode} profile — offline / feature-flag fallback.",
    )


async def fetch_live_weather(
    settings: Settings,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
    hours: int = 48,
) -> WeatherResponse:
    """
    OpenWeatherMap 5-day / 3-hour forecast, resampled to hourly.
    API key stays on the server only.
    """
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

    # 3-hourly samples → expand to hourly by linear hold
    raw: list[tuple[float, float]] = []
    for item in data.get("list", []):
        t = float(item["main"]["temp"])
        rh = float(item["main"].get("humidity", 50))
        raw.append((t, rh))

    if not raw:
        raise RuntimeError("OpenWeatherMap returned no forecast points")

    points: list[WeatherPoint] = []
    # Each OWM step is 3 hours; expand and trim to `hours`
    expanded_t: list[float] = []
    expanded_rh: list[float] = []
    for i, (t, rh) in enumerate(raw):
        expanded_t.append(t)
        expanded_rh.append(rh)
        if i + 1 < len(raw):
            t2, rh2 = raw[i + 1]
            for step in (1, 2):
                alpha = step / 3.0
                expanded_t.append(t + alpha * (t2 - t))
                expanded_rh.append(rh + alpha * (rh2 - rh))

    # If still short, tile diurnal pattern from what we have
    while len(expanded_t) < hours:
        expanded_t.append(expanded_t[len(expanded_t) % max(24, len(expanded_t))])
        expanded_rh.append(expanded_rh[len(expanded_rh) % max(24, len(expanded_rh))])

    for k in range(hours):
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
        lat=lat,
        lon=lon,
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
    if live and settings.openweather_api_key:
        try:
            return await fetch_live_weather(settings, lat, lon, city, hours=min(hours, 120))
        except Exception as exc:  # noqa: BLE001 — fallback for demo reliability
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
    """
    Fixed weekday 9–18 away prior. Kept as fallback for OccupancyPredictor
    when fewer than 14 days of real observations exist.
    """
    n = int(hours / dt_hours) if dt_hours else hours
    out: list[bool] = []
    for k in range(n):
        hod = int((k * dt_hours) % 24)
        day = int((k * dt_hours) // 24) % 7  # 0=Mon-like
        is_weekend = day >= 5
        if is_weekend:
            out.append(True)  # home
        else:
            out.append(not (work_start <= hod < work_end))
    return out


async def fetch_current_conditions(
    settings: Settings,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
) -> dict:
    """
    Current outdoor conditions for the dashboard card.
    Resolves city name via OpenWeather geocoding when lat/lon not provided.
    """
    if not settings.openweather_api_key:
        # Synthetic "now" based on local diurnal pattern
        from datetime import datetime
        hod = datetime.now().hour
        t = 28.0 + 6.0 * __import__("math").sin(((hod - 6) / 24.0) * 2.0 * 3.14159)
        return {
            "source": "synthetic",
            "city": city or settings.default_city,
            "lat": lat if lat is not None else settings.default_lat,
            "lon": lon if lon is not None else settings.default_lon,
            "temp_c": round(t, 1),
            "humidity": 60.0,
            "condition": "Clouds",
            "rain_mm_h": 0.0,
            "wind_kmh": 8.0,
            "feels_like_c": round(t + 1.5, 1),
            "note": "No API key — synthetic current conditions.",
        }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resolved_lat = lat
        resolved_lon = lon
        city_name = city or settings.default_city

        if (resolved_lat is None or resolved_lon is None) and city:
            geo = await client.get(
                "https://api.openweathermap.org/geo/1.0/direct",
                params={"q": city, "limit": 1, "appid": settings.openweather_api_key},
            )
            geo.raise_for_status()
            places = geo.json()
            if not places:
                raise RuntimeError(f"City not found: {city}")
            resolved_lat = float(places[0]["lat"])
            resolved_lon = float(places[0]["lon"])
            city_name = places[0].get("name") or city
        else:
            resolved_lat = resolved_lat if resolved_lat is not None else settings.default_lat
            resolved_lon = resolved_lon if resolved_lon is not None else settings.default_lon

        r = await client.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "lat": resolved_lat,
                "lon": resolved_lon,
                "appid": settings.openweather_api_key,
                "units": "metric",
            },
        )
        r.raise_for_status()
        data = r.json()
        main = data.get("main") or {}
        wind = data.get("wind") or {}
        weather0 = (data.get("weather") or [{}])[0]
        rain = data.get("rain") or {}
        return {
            "source": "live",
            "city": data.get("name") or city_name,
            "lat": resolved_lat,
            "lon": resolved_lon,
            "temp_c": round(float(main.get("temp", 28)), 1),
            "humidity": float(main.get("humidity", 55)),
            "condition": weather0.get("main") or "Clear",
            "rain_mm_h": float(rain.get("1h") or rain.get("3h") or 0),
            "wind_kmh": round(float(wind.get("speed", 0)) * 3.6, 1),
            "feels_like_c": round(float(main.get("feels_like", main.get("temp", 28))), 1),
            "note": "Live OpenWeatherMap current conditions.",
        }
