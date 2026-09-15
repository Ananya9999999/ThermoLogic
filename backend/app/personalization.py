"""
LinUCB contextual bandit for comfort-band personalization.

Separate linear model + uncertainty for t_min, t_max, h_min, h_max.
Defaults to population band until >=3 overrides.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np


def default_band() -> tuple[float, float, float, float]:
    return (22.0, 26.0, 40.0, 60.0)


def context_vector(
    hour: float,
    outdoor_temp: float,
    outdoor_humidity: float,
    day_of_week: int,
) -> np.ndarray:
    angle = 2 * np.pi * (hour % 24) / 24.0
    dow = np.zeros(7, dtype=float)
    dow[int(day_of_week) % 7] = 1.0
    return np.concatenate(
        [
            [1.0, np.sin(angle), np.cos(angle), outdoor_temp / 40.0, outdoor_humidity / 100.0],
            dow,
        ]
    )


@dataclass
class _Arm:
    """LinUCB stats for one continuous action dimension."""

    dim: int = 12
    alpha: float = 0.6
    A: np.ndarray = field(init=False)
    b: np.ndarray = field(init=False)

    def __post_init__(self) -> None:
        self.A = np.eye(self.dim)
        self.b = np.zeros(self.dim)

    def update(self, x: np.ndarray, y: float) -> None:
        x = x.reshape(-1)
        self.A = self.A + np.outer(x, x)
        self.b = self.b + x * y

    def predict(self, x: np.ndarray) -> tuple[float, float]:
        x = x.reshape(-1)
        A_inv = np.linalg.inv(self.A)
        theta = A_inv @ self.b
        mean = float(theta @ x)
        var = float(x @ A_inv @ x)
        ucb = mean + self.alpha * np.sqrt(max(var, 1e-9))
        return mean, ucb


@dataclass
class ComfortBandBandit:
    min_overrides: int = 3
    n_updates: int = 0
    t_min_arm: _Arm = field(default_factory=_Arm)
    t_max_arm: _Arm = field(default_factory=_Arm)
    h_min_arm: _Arm = field(default_factory=_Arm)
    h_max_arm: _Arm = field(default_factory=_Arm)

    def update(
        self,
        context: Sequence[float] | np.ndarray,
        observed_band: tuple[float, float, float, float],
    ) -> None:
        x = np.asarray(context, dtype=float)
        t_min, t_max, h_min, h_max = observed_band
        self.t_min_arm.update(x, t_min)
        self.t_max_arm.update(x, t_max)
        self.h_min_arm.update(x, h_min)
        self.h_max_arm.update(x, h_max)
        self.n_updates += 1

    def suggest(
        self,
        context: Sequence[float] | np.ndarray,
    ) -> tuple[tuple[float, float, float, float], str]:
        if self.n_updates < self.min_overrides:
            return default_band(), "low"

        x = np.asarray(context, dtype=float)
        t_min, v0 = self.t_min_arm.predict(x)
        t_max, v1 = self.t_max_arm.predict(x)
        h_min, v2 = self.h_min_arm.predict(x)
        h_max, v3 = self.h_max_arm.predict(x)

        # Clamp to sane HVAC ranges
        t_min = float(np.clip(t_min, 18.0, 28.0))
        t_max = float(np.clip(max(t_max, t_min + 1.0), 20.0, 32.0))
        h_min = float(np.clip(h_min, 30.0, 55.0))
        h_max = float(np.clip(max(h_max, h_min + 5.0), 45.0, 75.0))

        # Confidence from average posterior variance proxy (smaller var → higher conf)
        avg_var = (v0 + v1 + v2 + v3) / 4.0 - (
            (t_min + t_max + h_min + h_max) / 4.0
        )  # rough
        # Better: use only the bonus term magnitude via recompute
        vars_only = []
        for arm in (self.t_min_arm, self.t_max_arm, self.h_min_arm, self.h_max_arm):
            A_inv = np.linalg.inv(arm.A)
            vars_only.append(float(x @ A_inv @ x))
        mean_var = float(np.mean(vars_only))
        if self.n_updates >= 15 and mean_var < 0.35:
            conf = "high"
        elif self.n_updates >= 6 and mean_var < 0.8:
            conf = "medium"
        else:
            conf = "low"

        return (round(t_min, 1), round(t_max, 1), round(h_min, 1), round(h_max, 1)), conf
