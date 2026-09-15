"""
Learned occupancy schedule via per-timeslot logistic regression (numpy-only).

Falls back to weather.generate_occupancy_schedule() prior until >=14 days
of observations are available.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Sequence

import numpy as np

from .weather import generate_occupancy_schedule


def _features(ts: datetime, is_holiday: bool = False) -> np.ndarray:
    hod = ts.hour + ts.minute / 60.0
    angle = 2 * np.pi * hod / 24.0
    dow = np.zeros(7, dtype=float)
    dow[ts.weekday()] = 1.0
    return np.concatenate(
        [
            [1.0, np.sin(angle), np.cos(angle), 1.0 if is_holiday else 0.0],
            dow,
        ]
    )


def _sigmoid(z: np.ndarray | float) -> np.ndarray | float:
    z = np.clip(z, -30, 30)
    return 1.0 / (1.0 + np.exp(-z))


@dataclass
class OccupancyPredictor:
    """Online logistic occupancy model with strong prior until enough data."""

    min_days: int = 14
    lr: float = 0.08
    observations: list[tuple[datetime, bool, bool]] = field(default_factory=list)
    weights: np.ndarray = field(default_factory=lambda: np.zeros(11))

    def observe(self, timestamp: datetime, occupied: bool, is_holiday: bool = False) -> None:
        self.observations.append((timestamp, occupied, is_holiday))
        # Online SGD step
        x = _features(timestamp, is_holiday)
        p = float(_sigmoid(self.weights @ x))
        y = 1.0 if occupied else 0.0
        self.weights = self.weights + self.lr * (y - p) * x

    def _n_unique_days(self) -> int:
        return len({t.date() for t, _, _ in self.observations})

    def predict_proba(self, timestamp: datetime, is_holiday: bool = False) -> float:
        if self._n_unique_days() < self.min_days:
            # Prior from fixed schedule
            sched = generate_occupancy_schedule(hours=24, dt_hours=1.0)
            return 1.0 if sched[timestamp.hour % 24] else 0.15
        x = _features(timestamp, is_holiday)
        return float(_sigmoid(self.weights @ x))

    def predict_schedule(
        self,
        start: datetime,
        hours: int = 48,
        dt_hours: float = 1.0,
        is_holiday: bool = False,
    ) -> np.ndarray:
        n = int(hours / dt_hours)
        out = np.zeros(n, dtype=float)
        for k in range(n):
            ts = start + timedelta(hours=k * dt_hours)
            out[k] = self.predict_proba(ts, is_holiday=is_holiday)
        return out

    def comfort_band_scale(
        self,
        t_min: float,
        t_max: float,
        p_occupied: float,
        away_relax_deg: float = 1.5,
    ) -> tuple[float, float]:
        """Continuous relaxation: empty home → wider band."""
        scale = 1.0 - float(np.clip(p_occupied, 0.0, 1.0))
        return (
            t_min - away_relax_deg * scale,
            t_max + away_relax_deg * scale,
        )
