"""NWS Heat Index — Steadman simple branch + Rothfusz regression."""

from __future__ import annotations

import math


def calculate_heat_index(temp_c: float, humidity: float) -> float:
    if humidity is None or (isinstance(humidity, float) and math.isnan(humidity)):
        return temp_c
    rh = max(0.0, min(100.0, float(humidity)))
    T = (temp_c * 9.0 / 5.0) + 32.0

    hi = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + rh * 0.094)
    hi = (hi + T) / 2.0

    if hi < 80.0:
        return round(temp_c, 1)

    c1, c2, c3 = -42.379, 2.04901523, 10.14333127
    c4, c5, c6 = -0.22475541, -0.00683783, -0.05481717
    c7, c8, c9 = 0.00122874, 0.00085282, -0.00000199

    hi = (
        c1 + c2 * T + c3 * rh + c4 * T * rh + c5 * T * T + c6 * rh * rh
        + c7 * T * T * rh + c8 * T * rh * rh + c9 * T * T * rh * rh
    )

    if rh < 13.0 and 80.0 <= T <= 112.0:
        hi -= ((13.0 - rh) / 4.0) * math.sqrt((17.0 - abs(T - 95.0)) / 17.0)
    elif rh > 85.0 and 80.0 <= T <= 87.0:
        hi += ((rh - 85.0) / 10.0) * ((87.0 - T) / 5.0)

    return round((hi - 32.0) * 5.0 / 9.0, 1)


def comfort_preference_to_band(pref: str) -> tuple[float, float]:
    pref = (pref or "comfortable").strip().lower()
    if pref in ("cool", "colder", "cold"):
        return 23.0, 25.5
    if pref in ("warm", "warmer", "eco"):
        return 25.0, 27.5
    return 24.0, 26.5
