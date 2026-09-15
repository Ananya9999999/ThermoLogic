"""Unit tests for occupancy model, LinUCB bandit, and forecast bias corrector."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np

from app.occupancy_model import OccupancyPredictor
from app.personalization import ComfortBandBandit, context_vector
from app.forecast_bias import ForecastBiasCorrector


def test_occupancy_predictor_learns_away_window():
    pred = OccupancyPredictor(min_days=14)
    start = datetime(2026, 3, 2, 0, 0, tzinfo=timezone.utc)  # Monday
    # 21 days of weekday 9–18 away
    for d in range(21):
        day = start + timedelta(days=d)
        for h in range(24):
            ts = day.replace(hour=h)
            occupied = not (ts.weekday() < 5 and 9 <= h < 18)
            pred.observe(ts, occupied)
    assert pred._n_unique_days() >= 14
    # Tuesday 14:00 should be low occupancy
    tue_14 = start + timedelta(days=1, hours=14)
    p_away = pred.predict_proba(tue_14)
    # Tuesday 20:00 home
    tue_20 = start + timedelta(days=1, hours=20)
    p_home = pred.predict_proba(tue_20)
    assert p_away < 0.45, f"expected low proba at work hours, got {p_away}"
    assert p_home > 0.55, f"expected high proba evening, got {p_home}"
    t_min, t_max = pred.comfort_band_scale(22, 26, p_away, away_relax_deg=1.5)
    assert t_min < 22 and t_max > 26


def test_bandit_converges_with_confidence():
    bandit = ComfortBandBandit(min_overrides=3)
    # 20 evening overrides toward 23–24
    for i in range(20):
        ctx = context_vector(hour=20.0, outdoor_temp=28, outdoor_humidity=55, day_of_week=i % 7)
        bandit.update(ctx, (23.0, 24.0, 40.0, 55.0))
    ctx = context_vector(20.0, 28, 55, 2)
    band, conf = bandit.suggest(ctx)
    assert band[0] < 24.5 and band[1] < 26.0
    assert conf in ("medium", "high")
    # Single outlier should not dominate after many consistent points
    ctx2 = context_vector(20.0, 28, 55, 3)
    bandit.update(ctx2, (18.0, 19.0, 30.0, 40.0))
    band2, _ = bandit.suggest(ctx2)
    assert band2[0] > 20.0  # still pulled toward the cluster


def test_forecast_bias_converges():
    corr = ForecastBiasCorrector(min_obs=5)
    # Constant +2C bias, lead 1h
    for i in range(15):
        forecast = 30.0
        actual = 28.0
        corr.observe(1.0, forecast, actual, var="temp")
    adjusted = corr.correct(1.0, 30.0, var="temp")
    assert abs(adjusted - 28.0) < 0.6, f"expected ~28, got {adjusted}"
    # Under-trained bucket unchanged
    raw = corr.correct(20.0, 33.0, var="temp")
    assert raw == 33.0


if __name__ == "__main__":
    test_occupancy_predictor_learns_away_window()
    test_bandit_converges_with_confidence()
    test_forecast_bias_converges()
    print("all tests passed")
