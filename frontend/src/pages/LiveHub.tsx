import { useCallback, useEffect, useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from "recharts";
import {
  Plus, Trash2, RefreshCw, Home, Snowflake, Flame, Wind, Cpu,
} from "lucide-react";
import * as api from "../api";
import type { CatalogItem } from "../api";
import { useAuth } from "../context/AuthContext";
import { useReveal } from "../hooks/useReveal";
import "./LiveHub.css";
import {
  ThermostatControlPanel,
  ScheduleOccupancyOptimizer,
} from "../components/dashboard";

const KIND_ICON: Record<string, typeof Snowflake> = {
  ac: Snowflake,
  heater: Flame,
  heat_pump: Cpu,
  fan_coil: Wind,
};

export default function LiveHub() {
  useReveal();
  const { user } = useAuth();
  const [mode, setMode] = useState<"heatwave" | "smooth">("heatwave");
  const [liveWeather, setLiveWeather] = useState(false);
  const [catalog, setCatalog] = useState<{ acs: CatalogItem[]; refrigerators: CatalogItem[] }>({ acs: [], refrigerators: [] });
  const [pred, setPred] = useState<Awaited<ReturnType<typeof api.runPredict>> | null>(null);

  const [dash, setDash] = useState<Awaited<ReturnType<typeof api.fetchDashboard>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [band, setBand] = useState<{ tMin: number; tMax: number }>({ tMin: 22, tMax: 26 });

  // Calculator state (joined into this hub)
  const [calc, setCalc] = useState<api.CalcParams>({
    tonnage: 1.5, iseer: 3.8, hours_per_day: 6, days_per_year: 200,
    tariff_inr_per_kwh: 7, savings_pct: 15, peak_share_pct: 40, grid_ef_tco2_per_mwh: 0.71,
  });
  const [calcResult, setCalcResult] = useState<api.CalcResult | null>(null);

  // New appliance form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", kind: "ac", room: "Bedroom", tonnage: 1.5, iseer: 3.8, star: 3, power_w: 1400, catalog_id: "" as string, t_min: 22, t_max: 26,
  });

  const loadDash = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const d = await api.fetchDashboard(mode, 48);
      setDash(d);
      if (d.simulations.length && selectedId == null) {
        setSelectedId(d.simulations[0].appliance?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setBusy(false);
    }
  }, [mode, selectedId]);

  useEffect(() => { loadDash(); }, [mode, liveWeather]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.fetchCatalog().then((c) => setCatalog({ acs: c.acs, refrigerators: c.refrigerators })).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId && !dash?.appliances?.length) return;
    const id = selectedId || dash?.appliances?.[0]?.id;
    if (!id) return;
    api.runPredict({
      mode,
      use_live_weather: liveWeather,
      hours: 48,
      appliance_id: id,
      policy: "mpc",
    }).then(setPred).catch(() => setPred(null));
  }, [selectedId, mode, liveWeather, dash?.appliances]);


  useEffect(() => {
    const t = setTimeout(() => {
      api.runCalculator(calc).then(setCalcResult).catch(() => setCalcResult(null));
    }, 300);
    return () => clearTimeout(t);
  }, [calc]);

  async function addAppliance(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createAppliance(form);
      setShowAdd(false);
      setForm({ name: "", kind: "ac", room: "Bedroom", tonnage: 1.5, iseer: 3.8, t_min: 22, t_max: 26 });
      await loadDash();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add appliance");
    }
  }

  async function removeAppliance(id: number) {
    if (!confirm("Remove this appliance?")) return;
    await api.deleteAppliance(id);
    if (selectedId === id) setSelectedId(null);
    await loadDash();
  }

  const sim = dash?.simulations.find((s) => s.appliance?.id === selectedId) || dash?.simulations[0];
  const points = sim?.points?.slice(0, 48) || [];
  const agg = dash?.aggregate;

  return (
    <div className="container live-hub">
<header className="page-header reveal">
        <span className="badge badge-warm">Live · {user?.name}</span>
        <h1>Control Centre</h1>
        <p>
          Appliances, thermostat, occupancy schedule, scenarios, and savings —
          separate from the weather & comfort dashboard.
        </p>
      </header>

      <section className="control-extras reveal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <ThermostatControlPanel
          onBandChange={(tMin, tMax) => {
            setBand({ tMin, tMax });
            // Re-fetch prediction so charts reflect new comfort band
            const id = selectedId || dash?.appliances?.[0]?.id;
            if (id) {
              api.runPredict({
                mode,
                use_live_weather: liveWeather,
                hours: 48,
                appliance_id: id,
                policy: "mpc",
                t_min: tMin,
                t_max: tMax,
              }).then(setPred).catch(() => {});
            }
          }}
        />
        <ScheduleOccupancyOptimizer />
      </section>


      <div className="hub-toolbar reveal">
        <div className="seg">
          <button type="button" className={mode === "heatwave" ? "on" : ""} onClick={() => setMode("heatwave")}>Heatwave</button>
          <button type="button" className={mode === "smooth" ? "on" : ""} onClick={() => setMode("smooth")}>Smooth</button>
        </div>
        <button type="button" className={liveWeather ? "btn btn-primary" : "btn btn-outline"} onClick={() => setLiveWeather((v) => !v)}>
          {liveWeather ? "Live weather ON" : "Synthetic weather"}
        </button>
        <button type="button" className="btn btn-outline" onClick={loadDash} disabled={busy}>
          <RefreshCw size={15} /> {busy ? "Updating…" : "Refresh"}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add appliance
        </button>
      </div>

      {error && <p className="hub-error">{error}</p>}

      {/* Aggregate metrics */}
      <div className="agg-row reveal">
        <div className="card agg"><span>Appliances</span><strong>{agg?.appliance_count ?? "—"}</strong></div>
        <div className="card agg"><span>Energy savings</span><strong>{agg?.savings_pct ?? "—"}%</strong></div>
        <div className="card agg"><span>Period cost (ours)</span><strong>₹{agg?.cost_mpc_inr ?? "—"}</strong></div>
        <div className="card agg"><span>Saved vs baseline</span><strong>₹{agg?.saved_inr ?? "—"}</strong></div>
      </div>

      <div className="hub-grid">
        {/* Appliances list */}
        <section className="card appliances reveal">
          <h2><Home size={18} /> Your appliances</h2>
          <ul className="app-list">
            {(dash?.appliances || []).map((a) => {
              const Icon = KIND_ICON[a.kind] || Snowflake;
              return (
                <li key={a.id} className={selectedId === a.id ? "active" : ""}>
                  <button type="button" className="app-select" onClick={() => setSelectedId(a.id)}>
                    <Icon size={18} />
                    <div>
                      <strong>{a.name}</strong>
                      <span>{a.room} · {a.kind} · {a.tonnage}T</span>
                    </div>
                  </button>
                  <button type="button" className="app-del" onClick={() => removeAppliance(a.id)} title="Remove">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
            {!dash?.appliances?.length && <li className="empty">No appliances yet — add one to run live sims.</li>}
          </ul>
        </section>

        {/* Live chart for selected appliance */}
        <section className="card chart-panel reveal reveal-delay-1">
          <h2>
            Live trajectory
            {sim?.appliance ? ` · ${sim.appliance.name}` : ""}
          </h2>
          <p className="muted">
            Band {sim?.t_min ?? "—"}–{sim?.t_max ?? "—"} °C · outdoor vs baseline vs ThermoLogic
          </p>
          {points.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8f8078" }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#8f8078" }} />
                <Tooltip contentStyle={{ background: "#fffcfb", borderRadius: 12, border: "1px solid #e8dfe0" }} />
                <Legend />
                <Area type="monotone" dataKey="t_out" name="Outdoor" fill="#dab692" stroke="#8f5b34" fillOpacity={0.3} />
                <Line type="monotone" dataKey="t_in_baseline" name="Baseline" stroke="#8a9ea7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="t_in_mpc" name="ThermoLogic" stroke="#8d9b6a" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Select an appliance and refresh to load graphs.</p>
          )}
          {sim?.metrics && (
            <div className="sim-metrics">
              <span>Savings {sim.metrics.savings_pct}%</span>
              <span>Comfort {sim.metrics.comfort_mpc_pct}%</span>
              <span>Humidity {sim.metrics.avg_hum_mpc}% RH</span>
            </div>
          )}
        </section>
      </div>

      {/* Actuation chart */}
      {points.length > 0 && (
        <section className="card chart-panel reveal">
          <h2>Actuation intensity</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={points.filter((_, i) => i % 2 === 0)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8f8078" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8f8078" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="u_baseline" name="Baseline" fill="#8a9ea7" />
              <Bar dataKey="u_mpc" name="ThermoLogic" fill="#8d9b6a" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ML prediction */}
      {pred && (
        <section className="card chart-panel reveal">
          <h2>ML forecast · T, humidity &amp; energy</h2>
          <p className="muted">
            {pred.weather_source === "live" ? "Live weather" : "Synthetic"} · {pred.city}
            {" · "}Suggested band {pred.recommended_setpoint.t_min}–{pred.recommended_setpoint.t_max}°C
            ({pred.recommended_setpoint.reason})
          </p>
          <div className="sim-metrics">
            <span>Energy {pred.summary.energy_kwh} kWh</span>
            <span>Cost ₹{pred.summary.cost_inr}</span>
            <span>Comfort {pred.summary.comfort_pct}%</span>
            <span>Avg RH {pred.summary.avg_humidity}%</span>
            <span>{pred.summary.star}★ · {pred.summary.power_w}W · η {pred.summary.efficiency_scale}</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={pred.points}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8a7e6c" }} />
              <YAxis yAxisId="t" tick={{ fontSize: 11, fill: "#8a7e6c" }} />
              <YAxis yAxisId="h" orientation="right" domain={[30, 80]} tick={{ fontSize: 11, fill: "#8a7e6c" }} />
              <Tooltip />
              <Legend />
              <Area yAxisId="t" type="monotone" dataKey="t_out" name="Outdoor" fill="#d4c4a8" stroke="#6b4c32" fillOpacity={0.25} />
              <Line yAxisId="t" type="monotone" dataKey="t_in_pred" name="Predicted indoor" stroke="#6b7c3e" strokeWidth={2.5} dot={false} />
              <Line yAxisId="h" type="monotone" dataKey="humidity_pred" name="Predicted RH" stroke="#8b7355" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          {pred.research?.length > 0 && (
            <div className="research-notes">
              <strong>Research basis</strong>
              <ul>
                {pred.research.map((r) => (
                  <li key={r.title}><em>{r.title}</em> ({r.year}) — {r.relevance}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Calculator joined */}
      <section className="card calc-join reveal">
        <h2>Annual savings calculator</h2>
        <p className="muted">Tune household assumptions — updates as you drag.</p>
        <div className="calc-grid">
          <div className="calc-sliders">
            {([
              ["tonnage", "Tonnage", 0.75, 3, 0.25],
              ["iseer", "ISEER", 2.5, 6, 0.1],
              ["hours_per_day", "Hours / day", 1, 16, 0.5],
              ["days_per_year", "Days / year", 60, 365, 5],
              ["tariff_inr_per_kwh", "Tariff ₹/kWh", 3, 15, 0.5],
              ["savings_pct", "Savings %", 5, 30, 1],
            ] as const).map(([key, label, min, max, step]) => (
              <label key={key} className="field">
                {label} ({calc[key]})
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={calc[key]}
                  onChange={(e) => setCalc((c) => ({ ...c, [key]: +e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="calc-out">
            <div className="out-tile"><span>₹ / year saved</span><strong>{calcResult ? calcResult.saved_inr_year.toLocaleString("en-IN") : "—"}</strong></div>
            <div className="out-tile"><span>kWh saved</span><strong>{calcResult?.saved_kwh_year ?? "—"}</strong></div>
            <div className="out-tile"><span>tCO₂ avoided</span><strong>{calcResult?.co2_tons_year ?? "—"}</strong></div>
          </div>
        </div>
      </section>

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={addAppliance}>
            <h2>Add appliance</h2>
            <label className="field">Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bedroom AC" />
            </label>
            <label className="field">From catalog (auto-fills specs)
              <select
                value={form.catalog_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const item = [...catalog.acs, ...catalog.refrigerators].find((x) => x.id === id);
                  if (!item) {
                    setForm((f) => ({ ...f, catalog_id: "" }));
                    return;
                  }
                  setForm((f) => ({
                    ...f,
                    catalog_id: id,
                    name: f.name || `${item.brand} ${item.model}`,
                    kind: item.kind === "refrigerator" ? "refrigerator" : item.kind,
                    tonnage: item.tonnage ?? f.tonnage,
                    iseer: item.iseer ?? f.iseer,
                    star: item.star,
                    power_w: item.power_w,
                  }));
                }}
              >
                <option value="">Custom / manual</option>
                <optgroup label="Air conditioners">
                  {catalog.acs.map((a) => (
                    <option key={a.id} value={a.id}>{a.brand} {a.model} · {a.star}★ · {a.power_w}W</option>
                  ))}
                </optgroup>
                <optgroup label="Refrigerators">
                  {catalog.refrigerators.map((a) => (
                    <option key={a.id} value={a.id}>{a.brand} {a.model} · {a.star}★ · {a.power_w}W</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="field">Type
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="ac">Split / window AC</option>
                <option value="refrigerator">Refrigerator</option>
                <option value="heater">Room heater</option>
                <option value="heat_pump">Heat pump</option>
                <option value="fan_coil">Fan coil</option>
              </select>
            </label>
            <label className="field">Star rating ({form.star}★)
              <input type="range" min={1} max={5} step={1} value={form.star}
                onChange={(e) => setForm({ ...form, star: +e.target.value })} />
            </label>
            <label className="field">Rated power W ({form.power_w})
              <input type="range" min={80} max={2500} step={10} value={form.power_w}
                onChange={(e) => setForm({ ...form, power_w: +e.target.value })} />
            </label>
            <label className="field">Room
              <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </label>
            <label className="field">Tonnage ({form.tonnage})
              <input type="range" min={0.75} max={3} step={0.25} value={form.tonnage}
                onChange={(e) => setForm({ ...form, tonnage: +e.target.value })} />
            </label>
            <label className="field">Comfort band (°C)
              <div className="band-row">
                <input type="number" value={form.t_min} onChange={(e) => setForm({ ...form, t_min: +e.target.value })} />
                <span>to</span>
                <input type="number" value={form.t_max} onChange={(e) => setForm({ ...form, t_max: +e.target.value })} />
              </div>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
