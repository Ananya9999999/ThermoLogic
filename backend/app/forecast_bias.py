"""
Per lead-time Kalman bias correction for OpenWeatherMap forecasts.

Buckets: 0-3h, 3-6h, 6-12h, 12-24h × {temp, humidity}.
No-op until >=5 observations in a bucket.
"""

from __future__ import annotations

from dataclasses import dataclass, field


def _bucket(lead_h: float) -> str:
    if lead_h < 3:
        return "0-3h"
    if lead_h < 6:
        return "3-6h"
    if lead_h < 12:
        return "6-12h"
    return "12-24h"


@dataclass
class _ScalarKalman:
    Q: float = 0.01
    R: float = 0.5
    x: float = 0.0  # bias estimate
    P: float = 1.0
    n: int = 0

    def update(self, residual: float) -> None:
        # Predict
        self.P = self.P + self.Q
        # Update
        K = self.P / (self.P + self.R)
        self.x = self.x + K * (residual - self.x)
        self.P = (1 - K) * self.P
        self.n += 1


@dataclass
class ForecastBiasCorrector:
    min_obs: int = 5
    filters: dict[str, _ScalarKalman] = field(default_factory=dict)

    def _key(self, lead_h: float, var: str) -> str:
        return f"{_bucket(lead_h)}:{var}"

    def _get(self, lead_h: float, var: str) -> _ScalarKalman:
        k = self._key(lead_h, var)
        if k not in self.filters:
            self.filters[k] = _ScalarKalman()
        return self.filters[k]

    def observe(self, lead_time_hours: float, forecast_value: float, actual_value: float, var: str = "temp") -> None:
        residual = forecast_value - actual_value  # positive => forecast too high
        self._get(lead_time_hours, var).update(residual)

    def correct(self, lead_time_hours: float, forecast_value: float, var: str = "temp") -> float:
        kf = self._get(lead_time_hours, var)
        if kf.n < self.min_obs:
            return forecast_value
        return forecast_value - kf.x

    def snapshot(self) -> dict:
        out = {}
        for k, kf in self.filters.items():
            out[k] = {
                "bias": round(kf.x, 3),
                "variance": round(kf.P, 4),
                "n": kf.n,
                "active": kf.n >= self.min_obs,
            }
        return out
