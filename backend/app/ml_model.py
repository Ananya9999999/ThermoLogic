"""
Lightweight predictive model for indoor temperature, humidity, and energy.

Trained online from physics-based rollouts (same R-C plant as the simulator).
Predicts multi-step trajectories under a candidate control policy so the
dashboard can show "what ThermoLogic expects" given live/synthetic weather
and appliance efficiency (star / ISEER / rated power).

This is intentionally dependency-light (numpy only) for hackathon deployability,
while matching the structure of data-driven HVAC predictors in the literature.
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
        # Cooling capacity proxy; higher ISEER delivers more useful cooling per kW draw
        rated_kw = self.power_w / 1000.0
        # Effective cooling power scales with ISEER vs a 3.0 baseline
        return rated_kw * min(1.35, max(0.7, self.iseer / 3.5)) * 0.95

    @property
    def u_heat_max_kw(self) -> float:
        if self.kind in ("heater", "heat_pump"):
            return self.power_w / 1000.0
        return 1.5

    @property
    def efficiency_scale(self) -> float:
        # Higher star → less electrical energy for same thermal work
        return max(0.55, 1.15 - 0.08 * self.star) * (3.5 / max(self.iseer, 2.5))


class ThermalPredictor:
    """
    Multi-output linear residual model:
      [dT, dRH, kWh] ≈ W · features(outdoor, Tin, RH, price, u, appliance)

    Fitted on synthetic trajectories so predictions stay consistent with the
    plant used for MPC comparison.
    """

    def __init__(self) -> None:
        self.W: np.ndarray | None = None  # (3, n_features)
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

    def _simulate_step(
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
        dist = (t_out - t_in) / r + 0.2 + u_heat - u_cool
        t_next = t_in + dt * dist / c
        # Humidity: cooling dries air; idle drifts up
        if u_cool > 0.15:
            rh_next = rh - 2.2 * (u_cool / max(u_cool, 0.5)) - 0.3
        else:
            rh_next = rh + 0.35
        rh_next = float(np.clip(rh_next, 35, 75))
        kwh = (u_cool + u_heat) * dt * eff
        return float(t_next), rh_next, float(kwh)

    def _fit_default(self) -> None:
        """Generate synthetic samples and solve least squares for residual model."""
        rng = np.random.default_rng(42)
        xs, ys = [], []
        for _ in range(400):
            t_out = float(rng.uniform(22, 42))
            t_in = float(rng.uniform(20, 30))
            rh = float(rng.uniform(40, 70))
            price = float(rng.choice([4.2, 8.5]))
            u_max = float(rng.uniform(1.0, 4.0))
            u_cool = float(rng.uniform(0, u_max))
            u_heat = float(rng.uniform(0, 1.5)) if t_in < 22 else 0.0
            eff = float(rng.uniform(0.6, 1.1))
            r, c, dt = 2.5, 8.0, 1.0
            t2, rh2, kwh = self._simulate_step(
                t_in, rh, t_out, u_cool, u_heat, r, c, dt, eff
            )
            x = self._features(t_out, t_in, rh, price, u_cool, u_heat, eff, u_max)
            y = np.array([t2 - t_in, rh2 - rh, kwh])
            xs.append(x)
            ys.append(y)
        X = np.vstack(xs)
        Y = np.vstack(ys)
        # Ridge
        lam = 1e-2
        xtx = X.T @ X + lam * np.eye(X.shape[1])
        self.W = np.linalg.solve(xtx, X.T @ Y).T  # (3, n_feat)
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
        # Blend with physics for stability
        t_p, rh_p, kwh_p = self._simulate_step(
            t_in, rh, t_out, u_cool, u_heat, 2.5, 8.0, 1.0, eff
        )
        t_hat = 0.55 * (t_in + dT) + 0.45 * t_p
        rh_hat = 0.55 * (rh + dRH) + 0.45 * rh_p
        kwh_hat = 0.5 * max(0.0, kwh) + 0.5 * kwh_p
        return {
            "t_in": float(np.clip(t_hat, 16, 36)),
            "humidity": float(np.clip(rh_hat, 30, 80)),
            "energy_kwh": float(max(0.0, kwh_hat)),
        }

    def predict_horizon(
        self,
        t_out_series: Sequence[float],
        price_series: Sequence[float],
        appliance: AppliancePhysics,
        t_in0: float = 24.0,
        rh0: float = 52.0,
        t_min: float = 22.0,
        t_max: float = 26.0,
        policy: str = "mpc",
    ) -> list[dict]:
        """Roll out predictions with a simple comfort-aware policy."""
        t = t_in0
        rh = rh0
        out: list[dict] = []
        u_max = appliance.u_cool_max_kw
        for k, (t_out, price) in enumerate(zip(t_out_series, price_series)):
            # Policy: pre-cool if hot ahead / expensive peak awareness
            peak_ahead = max(t_out_series[k : k + 6]) if k < len(t_out_series) else t_out
            u_cool = u_heat = 0.0
            if policy == "mpc":
                target = t_min + 1.0 if peak_ahead > t_max + 3 else (t_min + t_max) / 2
                if t >= t_max - 0.2 or t > target + 0.4:
                    need = min(1.0, max(0.2, (t - target) / 3.0 + (t_out - 30) / 20))
                    if price > 7 and t < t_max - 0.4:
                        need *= 0.65
                    u_cool = need * u_max
                elif t <= t_min + 0.2:
                    u_heat = 0.5 * appliance.u_heat_max_kw
            else:  # reactive
                if t >= t_max:
                    u_cool = u_max
                elif t <= t_min:
                    u_heat = appliance.u_heat_max_kw

            pred = self.predict_step(t_out, t, rh, price, u_cool, u_heat, appliance)
            t, rh = pred["t_in"], pred["humidity"]
            out.append(
                {
                    "hour": k,
                    "t_out": round(t_out, 1),
                    "t_in_pred": round(t, 2),
                    "humidity_pred": round(rh, 1),
                    "u_cool": round(u_cool, 3),
                    "u_heat": round(u_heat, 3),
                    "energy_kwh": round(pred["energy_kwh"], 3),
                    "price": price,
                    "comfort_ok": t_min <= t <= t_max,
                }
            )
        return out


_predictor: ThermalPredictor | None = None


def get_predictor() -> ThermalPredictor:
    global _predictor
    if _predictor is None:
        _predictor = ThermalPredictor()
    return _predictor
