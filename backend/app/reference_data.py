"""Static reference data backing website claims."""

REFERENCE = {
    "product": {
        "name": "ThermoLogic",
        "tagline": "Comfort that thinks ahead",
        "description": (
            "Forecast-aware climate control for Indian homes — pre-cools before "
            "heatwaves, shifts load off peak tariffs, and keeps humidity from drifting."
        ),
    },
    "savings": {
        "pct_range": "10–20%",
        "typical_pct": 15,
        "annual_inr_range": "₹1,200 – ₹4,800",
        "city_mwh_range": "30,000 – 70,000 MWh / year",
        "co2_tons_range": "21,000 – 50,000 tCO₂ / year",
    },
    "bee": {
        "reference_hours_per_year": 1600,
        "note": "BEE ISEER annual units often assume ~1,600 operating hours/year.",
    },
    "grid": {
        "emission_factor_tco2_per_mwh": 0.71,
        "source": "CEA CO₂ Baseline Database (recent weighted-average order of magnitude)",
    },
    "tariffs": {
        "illustrative_offpeak_inr": 4.2,
        "illustrative_peak_inr": 8.5,
        "blended_typical_inr": 7.0,
        "note": "Varies by DISCOM and slab; peak hours make timing-aware control more valuable.",
    },
    "ac_presets": [
        {"label": "1.0 ton · 3★", "tonnage": 1.0, "iseer": 3.5, "typical_kwh_year": 900},
        {"label": "1.5 ton · 3★", "tonnage": 1.5, "iseer": 3.5, "typical_kwh_year": 1200},
        {"label": "1.5 ton · 5★", "tonnage": 1.5, "iseer": 5.0, "typical_kwh_year": 850},
        {"label": "2.0 ton · 5★", "tonnage": 2.0, "iseer": 5.0, "typical_kwh_year": 1100},
    ],
    "comfort_band_default": {"t_min_c": 22, "t_max_c": 26},
    "sources": [
        "BEE ISEER / annual units methodology",
        "CEA CO₂ Baseline Database",
        "State DISCOM tariff orders (illustrative averages)",
    ],
}
