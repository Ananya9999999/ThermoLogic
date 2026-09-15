"""
Predictive model for indoor temperature, humidity, and energy.

Hybrid physics + residual linear model fitted on synthetic R-C trajectories.
Uses appliance star rating, ISEER, and rated power so different ACs behave differently.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np


@dataclass
class AppliancePhysics:
    tonnage: float = 1.5
    star: int = 3
    iseer: float = 3.5
    power_w: float = 1400.0
    kind: str = "ac"

    @property
    def u_cool_max_kw(self) -> float:
        rated_kw = max(0.3, self.power_w / 1000.0)
        return rated_kw * min(1.4, max(0.65, self.iseer / 3.5)) * 0.95

    @property
    def u_heat_max_kw(self) -> float:
        if self.kind in ("heater", "heat_pump"):
            return max(0.3, self.power_w / 1000.0)
        return 1.5

    @property
    def efficiency_scale(self) -> float:
        # Electrical energy per unit cooling: lower is better (higher star / ISEER)
        return max(0.5, 1.2 - 0.09 * self.star) * (3.5 / max(self.iseer, 2.5))


class ThermalPredictor:
    def __init__(self) -> None:
        self.W: np.ndarray | None = None
        self.fitted = False
        self._fit_default()

    def _features(
        self,
        t_out: float,
        t_in: float,
        rh: float,
        price: float,
        u_cool: float,
        u_heat: float,
        eff: float,
        u_max: float,
    ) -> np.ndarray:
        return np.array(
            [
                1.0,
                t_out,
                t_in,
                t_out - t_in,
                rh / 100.0,
                price / 10.0,
                u_cool,
                u_heat,
                u_cool * eff,
                u_heat * eff,
                u_max,
                (t_out - 28.0) ** 2 / 100.0,
            ],
            dtype=float,
        )

    def _physics_step(
        self,
        t_in: float,
        rh: float,
        t_out: float,
        u_cool: float,
        u_heat: float,
        r: float,
        c: float,
        dt: float,
        eff: float,
    ) -> tuple[float, float, float]:
        dist = (t_out - t_in) / r + 0.25 + u_heat - u_cool
        t_next = t_in + dt * dist / c
        if u_cool > 0.12:
            rh_next = rh - 1.8 * min(1.0, u_cool / 1.5) - 0.4
        else:
            rh_next = rh + 0.45 + 0.02 * max(0.0, t_out - 30)
        rh_next = float(np.clip(rh_next, 35, 78))
        kwh = (u_cool + u_heat) * dt * eff
        return float(t_next), rh_next, float(max(0.0, kwh))

    def _fit_default(self) -> None:
        rng = np.random.default_rng(42)
        xs, ys = [], []
        for _ in range(600):
            t_out = float(rng.uniform(20, 44))
            t_in = float(rng.uniform(19, 32))
            rh = float(rng.uniform(38, 72))
            price = float(rng.choice([4.2, 6.0, 8.5]))
            u_max = float(rng.uniform(0.8, 4.5))
            u_cool = float(rng.uniform(0, u_max))
            u_heat = float(rng.uniform(0, 1.2)) if t_in < 22 else 0.0
            eff = float(rng.uniform(0.55, 1.15))
            t2, rh2, kwh = self._physics_step(
                t_in, rh, t_out, u_cool, u_heat, 2.5, 8.0, 1.0, eff
            )
            x = self._features(t_out, t_in, rh, price, u_cool, u_heat, eff, u_max)
            y = np.array([t2 - t_in, rh2 - rh, kwh])
            xs.append(x)
            ys.append(y)
        X = np.vstack(xs)
        Y = np.vstack(ys)
        lam = 1e-2
        xtx = X.T @ X + lam * np.eye(X.shape[1])
        self.W = np.linalg.solve(xtx, X.T @ Y).T
        self.fitted = True

    def predict_step(
        self,
        t_out: float,
        t_in: float,
        rh: float,
        price: float,
        u_cool: float,
        u_heat: float,
        appliance: AppliancePhysics,
    ) -> dict[str, float]:
        assert self.W is not None
        eff = appliance.efficiency_scale
        u_max = appliance.u_cool_max_kw
        x = self._features(t_out, t_in, rh, price, u_cool, u_heat, eff, u_max)
        dT, dRH, kwh = self.W @ x
        t_p, rh_p, kwh_p = self._physics_step(
            t_in, rh, t_out, u_cool, u_heat, 2.5, 8.0, 1.0, eff
        )
        # Physics-dominant blend for stable, realistic curves
        t_hat = 0.35 * (t_in + float(dT)) + 0.65 * t_p
        rh_hat = 0.35 * (rh + float(dRH)) + 0.65 * rh_p
        kwh_hat = 0.3 * max(0.0, float(kwh)) + 0.7 * kwh_p
        return {
            "t_in": float(np.clip(t_hat, 16, 38)),
            "humidity": float(np.clip(rh_hat, 30, 80)),
            "energy_kwh": float(max(0.0, kwh_hat)),
        }

    def predict_horizon(
        self,
        t_out_series: Sequence[float],
        price_series: Sequence[float],
        appliance: AppliancePhysics,
        t_in0: float = 24.0,
        rh0: float = 55.0,
        t_min: float = 22.0,
        t_max: float = 26.0,
        policy: str = "mpc",
    ) -> list[dict]:
        t = float(t_in0)
        rh = float(rh0)
        out: list[dict] = []
        u_max = appliance.u_cool_max_kw
        n = len(t_out_series)

        for k, (t_out, price) in enumerate(zip(t_out_series, price_series)):
            # Look-ahead peak for pre-cooling
            look = t_out_series[k : min(n, k + 6)]
            peak_ahead = max(look) if look else t_out
            u_cool = 0.0
            u_heat = 0.0

            if policy == "mpc":
                # Track midpoint of comfort band; pre-cool before outdoor spike
                target = (t_min + t_max) / 2.0
                if peak_ahead > t_max + 2.0:
                    target = t_min + 0.5
                err = t - target
                if err > 0.1 or t >= t_max - 0.1:
                    need = min(1.0, max(0.2, err / 2.0 + max(0.0, t_out - 30) / 20.0))
                    if price >= 7.5 and t < t_max - 0.4:
                        need *= 0.6
                    u_cool = need * u_max
                elif t < t_min + 0.15:
                    if appliance.kind in ("heater", "heat_pump"):
                        u_heat = 0.5 * appliance.u_heat_max_kw
                    else:
                        u_cool = 0.0
            else:
                # Reactive deadband
                if t >= t_max:
                    u_cool = u_max
                elif t <= t_min and appliance.kind in ("heater", "heat_pump"):
                    u_heat = appliance.u_heat_max_kw

            pred = self.predict_step(float(t_out), t, rh, float(price), u_cool, u_heat, appliance)
            t, rh = pred["t_in"], pred["humidity"]
            out.append(
                {
                    "hour": k,
                    "t_out": round(float(t_out), 1),
                    "t_in_pred": round(t, 2),
                    "humidity_pred": round(rh, 1),
                    "u_cool": round(u_cool, 3),
                    "u_heat": round(u_heat, 3),
                    "energy_kwh": round(pred["energy_kwh"], 3),
                    "price": float(price),
                    "comfort_ok": bool(t_min <= t <= t_max),
                }
            )
        return out


_predictor: ThermalPredictor | None = None


def get_predictor() -> ThermalPredictor:
    global _predictor
    if _predictor is None:
        _predictor = ThermalPredictor()
    return _predictor
