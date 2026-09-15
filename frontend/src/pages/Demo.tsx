import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  BarChart,
  Bar,
} from "recharts";
import { heatwaveData, smoothData, computeMetrics } from "../data/mockData";
import { useReveal } from "../hooks/useReveal";
import "./Demo.css";

type Mode = "heatwave" | "smooth";

export default function Demo() {
  useReveal();
  const [mode, setMode] = useState<Mode>("heatwave");
  const [away, setAway] = useState(false);
  const [comfortNudge, setComfortNudge] = useState(0);

  const data = mode === "heatwave" ? heatwaveData : smoothData;
  const metrics = useMemo(() => computeMetrics(data), [data]);
  const tMin = 22 - comfortNudge * 0.3 - (away ? 1.5 : 0);
  const tMax = 26 + comfortNudge * 0.3 + (away ? 1.5 : 0);
  const slice = data.slice(48, 120);

  return (
    <div className="container demo">
      <header className="page-header reveal">
        <span className="badge badge-warm">Interactive</span>
        <h1>Live demonstration</h1>
        <p>
          Explore how ThermoLogic behaves under a heatwave versus mild weather,
          with occupancy and preference controls you can adjust in real time.
        </p>
      </header>

      <div className="controls card reveal">
        <div className="control">
          <label>Weather scenario</label>
          <div className="seg">
            <button type="button" className={mode === "heatwave" ? "on" : ""} onClick={() => setMode("heatwave")}>
              Heatwave
            </button>
            <button type="button" className={mode === "smooth" ? "on" : ""} onClick={() => setMode("smooth")}>
              Smooth weather
            </button>
          </div>
        </div>
        <div className="control">
          <label>Occupancy</label>
          <div className="seg">
            <button type="button" className={!away ? "on" : ""} onClick={() => setAway(false)}>Home</button>
            <button type="button" className={away ? "on" : ""} onClick={() => setAway(true)}>Away</button>
          </div>
          <span className="hint">Away widens the comfort band to save energy when no one is home.</span>
        </div>
        <div className="control">
          <label>Preference nudge ({comfortNudge > 0 ? "+" : ""}{comfortNudge})</label>
          <input type="range" min={-2} max={2} step={1} value={comfortNudge} onChange={(e) => setComfortNudge(+e.target.value)} />
          <span className="hint">Stub for learning from manual overrides over time.</span>
        </div>
      </div>

      <div className="metrics-row reveal reveal-delay-1">
        <div className="card m-card">
          <span className="m-label">Energy savings</span>
          <span className="m-val">{metrics.savingsPct}%</span>
          <span className="m-sub">{metrics.energyMpc} vs {metrics.energyBase} kWh</span>
        </div>
        <div className="card m-card">
          <span className="m-label">Comfort (ours)</span>
          <span className="m-val">{metrics.comfortMpc}%</span>
          <span className="m-sub">Baseline {metrics.comfortBase}%</span>
        </div>
        <div className="card m-card">
          <span className="m-label">Avg humidity</span>
          <span className="m-val">{metrics.avgHumMpc}%</span>
          <span className="m-sub">Baseline {metrics.avgHumBase}% RH</span>
        </div>
        <div className="card m-card">
          <span className="m-label">Weekly cost</span>
          <span className="m-val">₹{metrics.costMpc}</span>
          <span className="m-sub">Baseline ₹{metrics.costBase}</span>
        </div>
      </div>

      <section className="card chart-block reveal">
        <h2>Indoor temperature · band {tMin.toFixed(1)}–{tMax.toFixed(1)} °C</h2>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={slice}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8a7c74" }} />
            <YAxis domain={[18, 40]} tick={{ fontSize: 11, fill: "#8a7c74" }} />
            <Tooltip contentStyle={{ background: "#faf7f7", border: "1px solid #d4cbcc", borderRadius: 12 }} />
            <Legend />
            <Area type="monotone" dataKey="tOut" name="Outdoor" fill="#dab692" stroke="#8f5b34" fillOpacity={0.3} />
            <Line type="monotone" dataKey="tInBaseline" name="Baseline" stroke="#8a9ea7" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="tInMpc" name="ThermoLogic" stroke="#8d9b6a" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <div className="two-col">
        <section className="card chart-block reveal">
          <h2>Humidity</h2>
          <p className="chart-desc">Baseline RH drifts while the unit idles; ThermoLogic does not.</p>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={slice}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8a7c74" }} />
              <YAxis domain={[40, 75]} tick={{ fontSize: 11, fill: "#8a7c74" }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="humidityBaseline" name="Baseline RH" stroke="#8a9ea7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="humidityMpc" name="ThermoLogic RH" stroke="#8d9b6a" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="card chart-block reveal reveal-delay-1">
          <h2>Actuation vs tariff</h2>
          <p className="chart-desc">Planning shifts cooling intensity away from expensive peak hours when safe.</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={slice.filter((_, i) => i % 3 === 0)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8a7c74" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8a7c74" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="uBaseline" name="Baseline" fill="#8a9ea7" />
              <Bar dataKey="uMpc" name="ThermoLogic" fill="#8d9b6a" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="card script-block reveal">
        <h2>Suggested 60–90 second walkthrough</h2>
        <ol>
          <li>Show the trajectory: ThermoLogic pre-cools before the outdoor spike so the room stays in band.</li>
          <li>Switch to smooth weather — savings remain meaningful because tariff timing still applies.</li>
          <li>Point to humidity: the reactive baseline drifts; ours holds a healthier RH.</li>
          <li>Toggle Away and the preference slider to show occupancy-aware and personalised comfort.</li>
        </ol>
      </section>
    </div>
  );
}
