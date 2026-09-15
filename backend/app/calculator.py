"""Energy savings calculator — parameters match claims on the website."""

from __future__ import annotations

from .models import CalculatorRequest, CalculatorResponse


# BEE-style annual hours reference; user can override via hours_per_day * days
DEFAULT_TARIFF = 7.0
DEFAULT_GRID_EF = 0.71  # tCO2/MWh CEA-order
DEFAULT_SAVINGS_PCT = 15.0


def compute_savings(req: CalculatorRequest) -> CalculatorResponse:
    # Annual cooling energy estimate
    # AEC ≈ capacity_kw * hours * load_factor / iseer_proxy
    # Simplified: use rated kW * annual hours * duty cycle
    capacity_kw = req.tonnage * 3.5  # approx kW cooling for tonnage
    annual_hours = req.hours_per_day * req.days_per_year
    # duty / efficiency factor: higher ISEER → lower energy
    efficiency_factor = max(0.35, 2.8 / max(req.iseer, 2.5))
    baseline_kwh = capacity_kw * annual_hours * efficiency_factor * 0.45

    savings_pct = req.savings_pct / 100.0
    saved_kwh = baseline_kwh * savings_pct
    mpc_kwh = baseline_kwh - saved_kwh

    tariff = req.tariff_inr_per_kwh
    baseline_cost = baseline_kwh * tariff
    mpc_cost = mpc_kwh * tariff
    saved_inr = baseline_cost - mpc_cost

    # Peak share amplifies bill savings slightly (tariff timing)
    peak_bonus = 1.0 + 0.15 * (req.peak_share_pct / 100.0)
    saved_inr *= peak_bonus
    mpc_cost = baseline_cost - saved_inr

    co2_tons = (saved_kwh / 1000.0) * req.grid_ef_tco2_per_mwh

    return CalculatorResponse(
        baseline_kwh_year=round(baseline_kwh, 1),
        mpc_kwh_year=round(mpc_kwh, 1),
        saved_kwh_year=round(saved_kwh, 1),
        baseline_cost_inr=round(baseline_cost, 0),
        mpc_cost_inr=round(mpc_cost, 0),
        saved_inr_year=round(saved_inr, 0),
        co2_tons_year=round(co2_tons, 3),
        assumptions={
            "capacity_kw_approx": round(capacity_kw, 2),
            "annual_hours": annual_hours,
            "efficiency_factor": round(efficiency_factor, 3),
            "peak_bonus_multiplier": round(peak_bonus, 3),
            "note": (
                "Illustrative model aligned with BEE-style hours and CEA-order "
                "grid intensity. Not a bill guarantee."
            ),
        },
    )
