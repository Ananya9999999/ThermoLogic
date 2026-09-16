"""
Live dynamic control loop for ThermoLogic.

Re-evaluates every call (weather change, user force-set, or periodic tick).
Primary metric = Heat Index (feels-like). High humidity → prefer Dry mode
instead of brute-force cooling. Uses time-of-day comfort profiles + short
forecast look-ahead so the plan anticipates spikes instead of reacting after.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from .heat_index import calculate_heat_index, comfort_preference_to_band

PERIODS = (
    "early_morning",  # 04–07
    "morning",        # 07–11
    "noon",           # 11–15
    "evening",        # 15–20
    "night",          # 20–04
)

DEFAULT_PROFILES: dict[str, dict[str, float]] = {
    "early_morning": {"feels_min": 23.0, "feels_max": 25.5, "raw_temp": 24.0, "humidity": 50.0},
    "morning":       {"feels_min": 23.5, "feels_max": 26.0, "raw_temp": 24.5, "humidity": 50.0},
    "noon":          {"feels_min": 24.0, "feels_max": 26.5, "raw_temp": 25.0, "humidity": 48.0},
    "evening":       {"feels_min": 23.5, "feels_max": 26.0, "raw_temp": 24.5, "humidity": 52.0},
    "night":         {"feels_min": 23.0, "feels_max": 25.5, "raw_temp": 24.0, "humidity": 55.0},
}


def period_for_hour(hour: int) -> str:
    h = hour % 24
    if 4 <= h < 7:
        return "early_morning"
    if 7 <= h < 11:
        return "morning"
    if 11 <= h < 15:
        return "noon"
    if 15 <= h < 20:
        return "evening"
    return "night"


def resolve_comfort_band(
    profiles: Optional[dict[str, dict[str, float]]],
    hour: Optional[int] = None,
    comfort_pref: str = "comfortable",
    force_feels_min: Optional[float] = None,
    force_feels_max: Optional[float] = None,
) -> tuple[float, float, str]:
    """Return (feels_min, feels_max, period). Force overrides win."""
    if force_feels_min is not None and force_feels_max is not None:
        return float(force_feels_min), float(force_feels_max), "forced"

    # Prefer client local hour when provided (UTC alone is wrong for IST etc.)
    if hour is not None:
        h = int(hour) % 24
    else:
        h = datetime.now().astimezone().hour
    period = period_for_hour(h)
    prof = (profiles or {}).get(period) or DEFAULT_PROFILES[period]
    lo = float(prof.get("feels_min", DEFAULT_PROFILES[period]["feels_min"]))
    hi = float(prof.get("feels_max", DEFAULT_PROFILES[period]["feels_max"]))

    # Soft nudge from global preference label
    band = comfort_preference_to_band(comfort_pref)
    lo = (lo + band[0]) / 2.0
    hi = (hi + band[1]) / 2.0
    if lo >= hi:
        hi = lo + 1.5
    return round(lo, 1), round(hi, 1), period



def _decide_industrial(
    t: float,
    rh: float,
    band_min: float,
    band_max: float,
    user_force_mode: Optional[str],
    user_force_setpoint: Optional[float],
) -> dict[str, Any]:
    """Process control: hold dry-bulb inside [band_min, band_max]. No heat-index."""
    if band_min > band_max:
        band_min, band_max = band_max, band_min
    mid = (band_min + band_max) / 2.0

    if user_force_mode and user_force_mode in ("cool", "dry", "heat", "idle", "off"):
        mode = "idle" if user_force_mode in ("off", "idle") else user_force_mode
        if mode == "dry":
            mode = "cool"
        power = 0.0 if mode == "idle" else 0.7
        reason = f"Operator forced mode → {mode}"
        target = float(user_force_setpoint) if user_force_setpoint is not None else mid
        return _pack(mode, power, target, t, band_min, band_max, reason, rh, None)

    if t > band_max:
        over = t - band_max
        power = min(1.0, 0.4 + 0.15 * max(over, 0.5))
        mode = "cool"
        reason = (
            f"Process temp {t:.1f}°C above band max {band_max:.1f}°C "
            f"(target {band_min:.1f}–{band_max:.1f}°C) → refrigeration / cooling"
        )
        target = mid
    elif t < band_min:
        if band_max <= 0:
            mode = "idle"
            power = 0.0
            reason = (
                f"Process temp {t:.1f}°C below band min {band_min:.1f}°C — "
                f"compressor off (avoid over-freeze)"
            )
        else:
            under = band_min - t
            mode = "heat"
            power = min(1.0, 0.35 + 0.15 * under)
            reason = f"Process temp {t:.1f}°C below band min {band_min:.1f}°C → heating"
        target = mid
    else:
        mode = "idle"
        power = 0.0
        reason = (
            f"Process temp {t:.1f}°C inside target band "
            f"({band_min:.1f}–{band_max:.1f}°C) — hold"
        )
        target = t

    if user_force_setpoint is not None:
        target = float(user_force_setpoint)
        if mode == "idle" and abs(t - target) > 0.5:
            if t > target:
                mode, power = "cool", 0.55
            elif band_max > 0:
                mode, power = "heat", 0.55
            reason = f"Tracking forced setpoint {target:.1f}°C"

    return _pack(mode, power, target, t, band_min, band_max, reason, rh, None)


def decide_action(
    room_temp_c: float,
    room_humidity: float,
    feels_min: float,
    feels_max: float,
    outdoor_temp: Optional[float] = None,
    outdoor_humidity: Optional[float] = None,
    forecast_next_3h: Optional[list[dict[str, float]]] = None,
    user_force_mode: Optional[str] = None,
    user_force_setpoint: Optional[float] = None,
    industrial: bool = False,
) -> dict[str, Any]:
    """
    Single-step live decision.

    Residential: Heat Index (feels-like) + Dry/Cool logic.
    Industrial: dry-bulb process band only (cold store, freezer, etc.).
    """
    rh = max(0.0, min(100.0, float(room_humidity)))
    t = float(room_temp_c)

    if industrial:
        return _decide_industrial(
            t, rh, feels_min, feels_max, user_force_mode, user_force_setpoint
        )

    feels = calculate_heat_index(t, rh)

    # User force wins (but we still compute feels + advice)
    if user_force_mode and user_force_mode in ("cool", "dry", "heat", "off", "idle"):
        mode = user_force_mode if user_force_mode != "off" else "idle"
        power = 0.0 if mode == "idle" else (0.55 if mode == "dry" else 0.85)
        reason = f"User forced mode → {mode}"
        if user_force_setpoint is not None:
            reason += f" (setpoint {user_force_setpoint:.1f}°C)"
        return _pack(mode, power, t, feels, feels_min, feels_max, reason, rh, forecast_next_3h)

    # Humidity bias: prefer Dry when RH is the main driver of discomfort
    high_rh = rh >= 60.0
    very_high_rh = rh >= 68.0
    feels_high = feels > feels_max
    feels_low = feels < feels_min
    margin_high = feels - feels_max
    margin_low = feels_min - feels

    # Look-ahead: if outdoor/forecast will push feels up soon, pre-act gently
    preemptive = False
    pre_reason = ""
    if forecast_next_3h:
        max_f = feels
        for pt in forecast_next_3h[:3]:
            ft = float(pt.get("t_out", outdoor_temp or t))
            frh = float(pt.get("humidity_out", outdoor_humidity or rh))
            # Approximate indoor drift toward outdoor
            pred_t = 0.7 * t + 0.3 * ft
            pred_rh = 0.75 * rh + 0.25 * frh
            pred_feels = calculate_heat_index(pred_t, pred_rh)
            if pred_feels > max_f:
                max_f = pred_feels
        if max_f > feels_max + 0.4 and not feels_high:
            preemptive = True
            pre_reason = f"Forecast peak feels ~{max_f:.1f}°C in next hours — pre-conditioning"

    if feels_low or (user_force_setpoint is not None and t < user_force_setpoint - 0.8):
        mode = "heat"
        power = min(1.0, 0.4 + 0.25 * max(margin_low, 0.5))
        reason = f"Feels-like {feels:.1f}°C below comfort floor {feels_min:.1f}°C"
    elif feels_high or preemptive:
        if very_high_rh or (high_rh and margin_high < 1.8):
            mode = "dry"
            # Moderate compressor + strong latent removal bias
            power = min(0.75, 0.35 + 0.2 * max(margin_high, 0.3) + (0.15 if very_high_rh else 0))
            reason = (
                f"Feels-like {feels:.1f}°C above band; RH {rh:.0f}% → Dry mode "
                f"(moisture removal + mild cool) instead of over-cooling"
            )
        else:
            mode = "cool"
            power = min(1.0, 0.45 + 0.3 * max(margin_high, 0.4))
            reason = f"Feels-like {feels:.1f}°C above comfort ceiling {feels_max:.1f}°C → Cool"
        if preemptive and not feels_high:
            reason = pre_reason + "; " + reason
    elif high_rh and feels > (feels_min + feels_max) / 2:
        # Inside band but sticky — light dry to keep comfort without big energy
        mode = "dry"
        power = 0.30
        reason = f"Inside feels band but RH {rh:.0f}% is high → light Dry to hold comfort efficiently"
    else:
        mode = "idle"
        power = 0.0
        reason = f"Feels-like {feels:.1f}°C inside comfort band ({feels_min:.1f}–{feels_max:.1f}°C)"

    # Suggested dry-bulb target: slightly higher when dehumidifying (energy save)
    if mode == "dry":
        target_dry = min(feels_max + 0.5, max(t - 0.8, feels_min + 0.5))
    elif mode == "cool":
        target_dry = max(feels_min, min(t - 1.2, feels_max - 0.5))
    elif mode == "heat":
        target_dry = min(feels_max, max(t + 1.0, feels_min + 0.3))
    else:
        target_dry = t

    if user_force_setpoint is not None:
        target_dry = float(user_force_setpoint)
        if mode == "idle" and abs(t - target_dry) > 0.6:
            mode = "cool" if t > target_dry else "heat"
            power = 0.5
            reason = f"Tracking user setpoint {target_dry:.1f}°C (was idle)"

    return _pack(mode, power, target_dry, feels, feels_min, feels_max, reason, rh, forecast_next_3h)


def _pack(
    mode: str,
    power: float,
    target_dry: float,
    feels: float,
    feels_min: float,
    feels_max: float,
    reason: str,
    rh: float,
    forecast: Optional[list[dict[str, float]]],
) -> dict[str, Any]:
    plan = []
    base_feels = feels
    for i in range(6):
        # Simple decay toward band for UI timeline
        if mode in ("cool", "dry") and base_feels > feels_max:
            step = -0.35 if mode == "cool" else -0.22
        elif mode == "heat" and base_feels < feels_min:
            step = 0.3
        else:
            step = 0.0
        base_feels = max(feels_min - 0.5, min(feels_max + 0.5, base_feels + step))
        m = mode if i < 3 or mode == "idle" else ("dry" if rh > 58 else mode)
        plan.append(
            {
                "hour_offset": i,
                "mode": m if i < 4 else "idle",
                "target_feels": round(base_feels, 1),
                "power": round(power * (0.85 ** i), 2) if m != "idle" else 0.0,
            }
        )

    return {
        "mode": mode,
        "power_fraction": round(max(0.0, min(1.0, power)), 2),
        "target_dry_bulb_c": round(target_dry, 1),
        "current_feels_c": round(feels, 1),
        "feels_min": feels_min,
        "feels_max": feels_max,
        "room_humidity": round(rh, 1),
        "reason": reason,
        "energy_hint": _energy_hint(mode, power),
        "plan_next_6h": plan,
        "decided_at": datetime.now(timezone.utc).isoformat(),
    }


def _energy_hint(mode: str, power: float) -> str:
    if mode == "idle":
        return "Compressor off — zero cooling energy"
    if mode == "dry":
        return f"Dry mode @ {int(power * 100)}% — lower compressor runtime than full Cool for same comfort"
    if mode == "cool":
        return f"Cool @ {int(power * 100)}% — standard sensible cooling"
    if mode == "heat":
        return f"Heat @ {int(power * 100)}%"
    return ""


def build_day_plan(
    profiles: Optional[dict[str, dict[str, float]]],
    weather_points: list[Any],
    comfort_pref: str = "comfortable",
) -> list[dict[str, Any]]:
    """24h plan from profiles + outdoor forecast (no sudden spikes)."""
    out: list[dict[str, Any]] = []
    for k, p in enumerate(weather_points[:24]):
        hod = getattr(p, "hour", k) % 24
        t_out = float(getattr(p, "t_out", 30))
        rh_out = float(getattr(p, "humidity_out", 55) or 55)
        lo, hi, period = resolve_comfort_band(profiles, hour=hod, comfort_pref=comfort_pref)
        # Approximate indoor feels from outdoor pull
        approx_t = 0.55 * 25.0 + 0.45 * t_out  # mild building lag
        approx_rh = 0.6 * 52.0 + 0.4 * rh_out
        feels = calculate_heat_index(approx_t, approx_rh)
        if feels > hi + 0.3:
            mode = "dry" if approx_rh >= 58 else "cool"
            power = 0.45 if mode == "dry" else 0.65
        elif feels < lo - 0.3:
            mode = "heat"
            power = 0.4
        else:
            mode = "idle"
            power = 0.0
        out.append(
            {
                "hour": hod,
                "period": period,
                "feels_min": lo,
                "feels_max": hi,
                "pred_feels": round(feels, 1),
                "mode": mode,
                "power": power,
                "t_out": round(t_out, 1),
                "rh_out": round(rh_out, 1),
            }
        )
    return out
