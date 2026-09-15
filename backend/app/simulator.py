"""
Thermal simulation: baseline deadband vs ThermoLogic predictive + humidity-aware controller.

Key features (v0.4):
- Heat Index ("feels like") is the primary comfort metric for the smart controller.
- Setpoint-shift: raise dry-bulb target when RH is high (save compressor energy).
- Dry / low-fan latent bias instead of over-cooling.
- Hysteresis on the feels-like band.
- Short-horizon cost-aware planning (tariff + comfort).
"""

from __future__ import annotations

from typing import Sequence

from .config import Settings
from .heat_index import calculate_heat_index, comfort_preference_to_band
from .models import (
    SimMetrics,
    SimResponse,
    TrajectoryPoint,
    WeatherPoint,
)


def _internal_gains(hour: int) -> float:
    hod = hour % 24
    if 7 <= hod <= 9 or 18 <= hod <= 22:
        return 0.35
    if 0 <= hod <= 6:
        return 0.1
    return 0.2


def baseline_reactive_thermostat(
    t_in0: float,
    t_out: Sequence[float],
    q_gains: Sequence[float],
    t_min: float,
    t_max: float,
    r: float,
    c: float,
    dt: float,
    u_heat_max: float,
    u_cool_max: float,
) -> tuple[list[float], list[float], list[float]]:
    """Classic deadband hysteresis thermostat (fair reactive baseline)."""
    n = len(t_out)
    t_in = [0.0] * n
    u_cool = [0.0] * n
    u_heat = [0.0] * n
    mode = 0
    t = t_in0
    mid = (t_min + t_max) / 2.0

    for k in range(n):
        if mode == 1 and t >= mid:
            mode = 0
        if mode == -1 and t <= mid:
            mode = 0
        if t <= t_min:
            mode = 1
        if t >= t_max:
            mode = -1

        uh = u_heat_max if mode == 1 else 0.0
        uc = u_cool_max if mode == -1 else 0.0
        u_heat[k] = uh
        u_cool[k] = uc

        dtdt = (t_out[k] - t) / r + q_gains[k] + uh - uc
        t = t + dt * dtdt / c
        t_in[k] = t

    return t_in, u_cool, u_heat


def humidity_aware_controller(
    t_in0: float,
    t_out: Sequence[float],
    q_gains: Sequence[float],
    prices: Sequence[float],
    rh_out: Sequence[float],
    hi_min: float,
    hi_max: float,
    r: float,
    c: float,
    dt: float,
    u_heat_max: float,
    u_cool_max: float,
    horizon: int = 6,
) -> tuple[list[float], list[float], list[float], list[float], list[str]]:
    """
    Predictive + humidity-aware controller.
    Primary metric: Heat Index. High RH → setpoint shift + dry bias.
    """
    n = len(t_out)
    t_in = [0.0] * n
    u_cool = [0.0] * n
    u_heat = [0.0] * n
    rh_in = [0.0] * n
    modes: list[str] = ["idle"] * n

    t = t_in0
    rh = 55.0
    mode = "idle"
    cool_levels = [0.0, 0.25, 0.5, 0.75, 1.0]
    heat_levels = [0.0, 0.35, 0.7, 1.0]

    hi_enter_high = hi_max + 0.3
    hi_exit_high = hi_max - 0.6
    hi_enter_low = hi_min - 0.3
    hi_exit_low = hi_min + 0.6

    for k in range(n):
        outdoor_pull = 0.08 * (rh_out[k] - rh)
        if mode in ("cool", "dry"):
            latent = 0.45 if mode == "dry" else 0.28
            prev_uc = u_cool[k - 1] if k > 0 else 0.5
            rh -= latent * (prev_uc / max(u_cool_max, 0.1))
        rh += outdoor_pull + 0.04
        rh = max(35.0, min(75.0, rh))
        rh_in[k] = round(rh, 1)

        feels = calculate_heat_index(t, rh)

        if rh > 62.0:
            t_target_max = 26.5
            prefer_dry = True
        elif rh > 55.0:
            t_target_max = 25.8
            prefer_dry = True
        else:
            t_target_max = 25.0
            prefer_dry = False
        t_target_min = t_target_max - 3.5

        best_cost = float("inf")
        best_uc, best_uh = 0.0, 0.0
        best_mode = "idle"
        forced = False

        if feels >= hi_enter_high or t >= t_target_max + 0.4:
            best_uc = u_cool_max * (0.65 if prefer_dry else 1.0)
            best_uh = 0.0
            best_mode = "dry" if prefer_dry else "cool"
            forced = True
        elif feels <= hi_enter_low or t <= t_target_min - 0.3:
            best_uc = 0.0
            best_uh = u_heat_max
            best_mode = "heat"
            forced = True
        elif mode in ("cool", "dry") and feels <= hi_exit_high and t <= t_target_max:
            best_uc = (u_cool[k - 1] * 0.7) if k > 0 else 0.4 * u_cool_max
            best_mode = mode
            forced = True
        elif mode == "heat" and feels >= hi_exit_low:
            best_uh = 0.0
            best_mode = "idle"
            forced = True

        if not forced:
            candidates: list[tuple[float, float, str]] = [(0.0, 0.0, "idle")]
            for f in cool_levels[1:]:
                m = "dry" if prefer_dry and f <= 0.75 else "cool"
                scale = 0.85 if m == "dry" else 1.0
                candidates.append((f * u_cool_max * scale, 0.0, m))
            for f in heat_levels[1:]:
                candidates.append((0.0, f * u_heat_max, "heat"))

            for uc, uh, m in candidates:
                tt = t
                rr = rh
                cost = 0.0
                feasible = True
                h_end = min(n, k + horizon)
                for j in range(k, h_end):
                    if j == k:
                        ujc, ujh = uc, uh
                    else:
                        dist_j = (t_out[j] - tt) / r + q_gains[j]
                        t_pred = tt + dt * dist_j / c
                        ujc = ujh = 0.0
                        if t_pred > t_target_max - 0.3:
                            ujc = 0.55 * u_cool_max
                        elif t_pred < t_target_min + 0.3:
                            ujh = 0.5 * u_heat_max
                    dist = (t_out[j] - tt) / r + q_gains[j] + ujh - ujc
                    tt = tt + dt * dist / c
                    if ujc > 0.1:
                        rr -= 0.3 * (ujc / u_cool_max)
                    else:
                        rr += 0.06
                    rr = max(35.0, min(75.0, rr))
                    cost += (ujc + ujh) * prices[j] * dt
                    hi_pred = calculate_heat_index(tt, rr)
                    if hi_pred > hi_max:
                        cost += 180.0 * (hi_pred - hi_max) ** 2
                        if hi_pred > hi_max + 1.2:
                            feasible = False
                    if hi_pred < hi_min:
                        cost += 180.0 * (hi_min - hi_pred) ** 2
                        if hi_pred < hi_min - 1.2:
                            feasible = False
                    if tt > t_target_max + 1.5 or tt < t_target_min - 1.5:
                        feasible = False
                if not feasible:
                    cost += 1e6
                if cost < best_cost:
                    best_cost = cost
                    best_uc, best_uh = uc, uh
                    best_mode = m

        dist0 = (t_out[k] - t) / r + q_gains[k] + best_uh - best_uc
        t = t + dt * dist0 / c
        t = max(18.0, min(32.0, t))

        u_cool[k] = best_uc
        u_heat[k] = best_uh
        modes[k] = best_mode
        mode = best_mode
        t_in[k] = t

    return t_in, u_cool, u_heat, rh_in, modes


def _humidity_trace_baseline(
    u_cool: Sequence[float],
    hours: int,
    heatwave_boost: float = 0.0,
) -> list[float]:
    rh = 52.0 + heatwave_boost
    out: list[float] = []
    for k in range(hours):
        if u_cool[k] < 0.15 * 3.5:
            rh += 0.12
        else:
            rh -= 0.30 * (u_cool[k] / 3.5)
        rh = max(42.0, min(72.0, rh))
        out.append(round(rh, 1))
    return out


def run_simulation(
    settings: Settings,
    weather: Sequence[WeatherPoint],
    t_min: float,
    t_max: float,
    away: bool = False,
    comfort_nudge: int = 0,
    city: str = "Bengaluru",
    weather_source: str = "synthetic",
    comfort_pref: str = "comfortable",
) -> SimResponse:
    t_min_eff = t_min - comfort_nudge * 0.3
    t_max_eff = t_max + comfort_nudge * 0.3
    if away:
        t_min_eff -= 1.5
        t_max_eff += 1.5

    hi_min, hi_max = comfort_preference_to_band(comfort_pref)
    if away:
        hi_min -= 1.0
        hi_max += 1.5
    hi_min += comfort_nudge * 0.25
    hi_max += comfort_nudge * 0.25

    n = len(weather)
    t_out = [p.t_out for p in weather]
    prices = [p.price for p in weather]
    rh_out = [
        (p.humidity_out if p.humidity_out is not None else 55.0) for p in weather
    ]
    gains = [_internal_gains(k) for k in range(n)]

    t_base, uc_base, uh_base = baseline_reactive_thermostat(
        settings.t_in0,
        t_out,
        gains,
        t_min_eff,
        t_max_eff,
        settings.r_thermal,
        settings.c_thermal,
        settings.dt_hours,
        settings.u_heat_max,
        settings.u_cool_max,
    )

    t_mpc, uc_mpc, uh_mpc, rh_mpc, modes = humidity_aware_controller(
        settings.t_in0,
        t_out,
        gains,
        prices,
        rh_out,
        hi_min,
        hi_max,
        settings.r_thermal,
        settings.c_thermal,
        settings.dt_hours,
        settings.u_heat_max,
        settings.u_cool_max,
    )

    heatwave_boost = 4.0 if any(t > 36 for t in t_out) else 0.0
    rh_base = _humidity_trace_baseline(uc_base, hours=n, heatwave_boost=heatwave_boost)

    hi_base = [calculate_heat_index(t_base[k], rh_base[k]) for k in range(n)]
    hi_mpc = [calculate_heat_index(t_mpc[k], rh_mpc[k]) for k in range(n)]

    u_base_tot = [uc_base[i] + uh_base[i] for i in range(n)]
    u_mpc_tot = [uc_mpc[i] + uh_mpc[i] for i in range(n)]

    e_base = sum(u_base_tot) * settings.dt_hours
    e_mpc = sum(u_mpc_tot) * settings.dt_hours
    savings = ((e_base - e_mpc) / e_base * 100.0) if e_base > 1e-6 else 0.0

    def comfort_pct_hi(series: list[float], lo: float, hi: float) -> float:
        ok = sum(1 for v in series if lo <= v <= hi)
        return 100.0 * ok / max(1, len(series))

    cost_base = sum(u_base_tot[i] * prices[i] * settings.dt_hours for i in range(n))
    cost_mpc = sum(u_mpc_tot[i] * prices[i] * settings.dt_hours for i in range(n))

    points = [
        TrajectoryPoint(
            hour=k,
            t_out=round(t_out[k], 1),
            t_in_baseline=round(t_base[k], 2),
            t_in_mpc=round(t_mpc[k], 2),
            u_baseline=round(u_base_tot[k], 3),
            u_mpc=round(u_mpc_tot[k], 3),
            humidity_baseline=rh_base[k],
            humidity_mpc=rh_mpc[k],
            price=prices[k],
            feels_baseline=hi_base[k],
            feels_mpc=hi_mpc[k],
            mode_mpc=modes[k],
        )
        for k in range(n)
    ]

    metrics = SimMetrics(
        energy_base_kwh=round(e_base, 2),
        energy_mpc_kwh=round(e_mpc, 2),
        savings_pct=round(savings, 1),
        comfort_base_pct=round(comfort_pct_hi(hi_base, hi_min, hi_max), 1),
        comfort_mpc_pct=round(comfort_pct_hi(hi_mpc, hi_min, hi_max), 1),
        avg_hum_base=round(sum(rh_base) / n, 1),
        avg_hum_mpc=round(sum(rh_mpc) / n, 1),
        cost_base_inr=round(cost_base, 0),
        cost_mpc_inr=round(cost_mpc, 0),
        avg_feels_base=round(sum(hi_base) / n, 1),
        avg_feels_mpc=round(sum(hi_mpc) / n, 1),
    )

    script = [
        "ThermoLogic controls on Heat Index (feels-like), not just dry-bulb.",
        "High humidity → setpoint shift + dry/low-fan bias instead of over-cooling.",
        "Pre-cools / pre-dehumidifies using outdoor forecast and tariff windows.",
        "Hysteresis prevents mode chatter; energy drops once the feels-like band is held.",
    ]

    return SimResponse(
        weather_source=weather_source,  # type: ignore[arg-type]
        city=city,
        t_min=round(t_min_eff, 1),
        t_max=round(t_max_eff, 1),
        away=away,
        metrics=metrics,
        points=points,
        demo_script=script,
        parameters_used={
            "hi_min": hi_min,
            "hi_max": hi_max,
            "comfort_pref": comfort_pref,
        },
    )
