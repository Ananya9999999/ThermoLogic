import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IndianRupee, Leaf, Zap, SlidersHorizontal } from "lucide-react";
import * as api from "../api";
import { useAuth } from "../context/AuthContext";
import { useReveal } from "../hooks/useReveal";
import "./Calculator.css";

const DEFAULTS: api.CalcParams = {
  tonnage: 1.5,
  iseer: 3.8,
  hours_per_day: 6,
  days_per_year: 200,
  tariff_inr_per_kwh: 7,
  savings_pct: 15,
  peak_share_pct: 40,
  grid_ef_tco2_per_mwh: 0.71,
};

export default function Calculator() {
  useReveal();
  const { user } = useAuth();
  const [params, setParams] = useState<api.CalcParams>(DEFAULTS);
  const [result, setResult] = useState<api.CalcResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<{ label: string; tonnage: number; iseer: number }[]>([]);

  useEffect(() => {
    api.fetchImpact().then((d) => {
      const p = d.ac_presets as { label: string; tonnage: number; iseer: number }[] | undefined;
      if (p) setPresets(p);
    }).catch(() => {});
  }, []);

  const run = useCallback(async (p: api.CalcParams) => {
    setBusy(true);
    setError("");
    try {
      const r = await api.runCalculator(p);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculator unavailable — is the API running?");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => run(params), 280);
    return () => clearTimeout(t);
  }, [params, run]);

  function set<K extends keyof api.CalcParams>(key: K, value: number) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="container calc-page">
      <header className="page-header reveal">
        <span className="badge badge-sage">Interactive</span>
        <h1>Energy savings calculator</h1>
        <p>
          Adjust AC size, efficiency, usage, and tariff. Estimates use the same
          assumptions as our Impact page (BEE-style hours, CEA-order grid factor).
          {!user && (
            <>
              {" "}
              <Link to="/signup">Sign up</Link> to keep exploring with an account.
            </>
          )}
        </p>
      </header>

      {presets.length > 0 && (
        <div className="presets reveal">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="preset-btn"
              onClick={() => setParams((prev) => ({ ...prev, tonnage: p.tonnage, iseer: p.iseer }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="calc-layout">
        <section className="card calc-controls reveal">
          <h2><SlidersHorizontal size={18} /> Parameters</h2>
          <label>
            Tonnage ({params.tonnage} T)
            <input type="range" min={0.75} max={3} step={0.25} value={params.tonnage}
              onChange={(e) => set("tonnage", +e.target.value)} />
          </label>
          <label>
            ISEER ({params.iseer})
            <input type="range" min={2.5} max={6} step={0.1} value={params.iseer}
              onChange={(e) => set("iseer", +e.target.value)} />
          </label>
          <label>
            Hours / day ({params.hours_per_day})
            <input type="range" min={1} max={16} step={0.5} value={params.hours_per_day}
              onChange={(e) => set("hours_per_day", +e.target.value)} />
          </label>
          <label>
            Cooling days / year ({params.days_per_year})
            <input type="range" min={60} max={365} step={5} value={params.days_per_year}
              onChange={(e) => set("days_per_year", +e.target.value)} />
          </label>
          <label>
            Tariff ₹/kWh ({params.tariff_inr_per_kwh})
            <input type="range" min={3} max={15} step={0.5} value={params.tariff_inr_per_kwh}
              onChange={(e) => set("tariff_inr_per_kwh", +e.target.value)} />
          </label>
          <label>
            ThermoLogic savings % ({params.savings_pct}%)
            <input type="range" min={5} max={30} step={1} value={params.savings_pct}
              onChange={(e) => set("savings_pct", +e.target.value)} />
          </label>
          <label>
            Peak load share ({params.peak_share_pct}%)
            <input type="range" min={0} max={80} step={5} value={params.peak_share_pct}
              onChange={(e) => set("peak_share_pct", +e.target.value)} />
          </label>
          <label>
            Grid EF tCO₂/MWh ({params.grid_ef_tco2_per_mwh})
            <input type="range" min={0.4} max={1.2} step={0.01} value={params.grid_ef_tco2_per_mwh}
              onChange={(e) => set("grid_ef_tco2_per_mwh", +e.target.value)} />
          </label>
          {busy && <p className="hint">Updating…</p>}
          {error && <p className="auth-error">{error}</p>}
        </section>

        <section className="calc-results reveal reveal-delay-1">
          <div className="card result-tile">
            <IndianRupee size={20} />
            <div>
              <span className="r-label">Saved per year</span>
              <strong>₹{result ? result.saved_inr_year.toLocaleString("en-IN") : "—"}</strong>
            </div>
          </div>
          <div className="card result-tile">
            <Zap size={20} />
            <div>
              <span className="r-label">Energy saved</span>
              <strong>{result ? `${result.saved_kwh_year} kWh` : "—"}</strong>
            </div>
          </div>
          <div className="card result-tile">
            <Leaf size={20} />
            <div>
              <span className="r-label">CO₂ avoided</span>
              <strong>{result ? `${result.co2_tons_year} t` : "—"}</strong>
            </div>
          </div>
          <div className="card compare">
            <h3>Annual comparison</h3>
            <div className="compare-row">
              <span>Baseline consumption</span>
              <span>{result ? `${result.baseline_kwh_year} kWh · ₹${result.baseline_cost_inr.toLocaleString("en-IN")}` : "—"}</span>
            </div>
            <div className="compare-row">
              <span>With ThermoLogic</span>
              <span>{result ? `${result.mpc_kwh_year} kWh · ₹${result.mpc_cost_inr.toLocaleString("en-IN")}` : "—"}</span>
            </div>
            <p className="disclaimer">
              Illustrative model aligned with website claims. Not a utility bill guarantee.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
