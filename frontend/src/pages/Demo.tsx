import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
  BarChart,
  Bar,
} from "recharts";
import { heatwaveData, smoothData, computeMetrics } from "../data/mockData";
import "./Demo.css";

type Mode = "heatwave" | "smooth";

export default function Demo() {
  const [mode, setMode] = useState<Mode>("heatwave");
  const [away, setAway] = useState(false);
  const [comfortNudge, setComfortNudge] = useState(0); // personalization stub

  const data = mode === "heatwave" ? heatwaveData : smoothData;
  const metrics = useMemo(() => computeMetrics(data), [data]);

  // Personalization: widen/narrow band visually
  const tMin = 22 - comfortNudge * 0.3;
  const tMax = 26 + comfortNudge * 0.3;
  // Away: further relax
  const effectiveMin = away ? tMin - 1.5 : tMin;
  const effectiveMax = away ? tMax + 1.5 : tMax;

  const slice = data.slice(48, 120).map((d) => ({
    ...d,
    label: `H${d.hour}`,
  }));

  return (
    <div className="container demo-page">
      <header className="page-header">
        <h1>Live Demo</h1>
        <p>
          60–90 second narrative: watch the trajectory pre-cool, toggle weather,
          check humidity, then show tariff timing and occupancy.
        </p>
      </header>

      <div className="controls card">
        <div className="control-group">
          <label>Weather scenario</label>
          <div className="toggle-row">
            <button
              className={mode === "heatwave" ? "toggle active" : "toggle"}
              onClick={() => setMode("heatwave")}
            >
              Heatwave
            </button>
            <button
              className={mode === "smooth" ? "toggle active" : "toggle"}
              onClick={() => setMode("smooth")}
            >
              Smooth weather
            </button>
          </div>
        </div>
        <div className="control-group">
          <label>Occupancy</label>
          <div className="toggle-row">
            <button
              className={!away ? "toggle active" : "toggle"}
              onClick={() => setAway(false)}
            >
              Home
            </button>
            <button
              className={away ? "toggle active" : "toggle"}
              onClick={() => setAway(true)}
            >
              Away
            </button>
          </div>
          <span className="hint">
            Away widens comfort band (±1.5 °C) — answers “what if nobody’s home?”
          </span>
        </div>
        <div className="control-group">
          <label>
            Personalization nudge ({comfortNudge > 0 ? "+" : ""}
            {comfortNudge})
          </label>
          <input
            type="range"
            min={-2}
            max={2}
            step={1}
            value={comfortNudge}
            onChange={(e) => setComfortNudge(+e.target.value)}
          />
          <span className="hint">
            Stub: learns from manual overrides and shifts the preferred band.
          </span>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric card">
          <span className="m-label">Energy savings</span>
          <span className="m-value">{metrics.savingsPct}%</span>
          <span className="m-sub">
            {metrics.energyMpc} vs {metrics.energyBase} kWh
          </span>
        </div>
        <div className="metric card">
          <span className="m-label">Comfort (MPC)</span>
          <span className="m-value success">{metrics.comfortMpc}%</span>
          <span className="m-sub">Baseline {metrics.comfortBase}%</span>
        </div>
        <div className="metric card">
          <span className="m-label">Humidity (avg)</span>
          <span className="m-value">
            {metrics.avgHumMpc}% <span className="vs">vs {metrics.avgHumBase}%</span>
          </span>
          <span className="m-sub">Ours stays tighter</span>
        </div>
        <div className="metric card">
          <span className="m-label">Cost this week</span>
          <span className="m-value">₹{metrics.costMpc}</span>
          <span className="m-sub">Baseline ₹{metrics.costBase}</span>
        </div>
      </div>

      <section className="card chart-card">
        <h2>
          Indoor temperature · {mode === "heatwave" ? "Heatwave" : "Smooth"} ·
          band {effectiveMin.toFixed(1)}–{effectiveMax.toFixed(1)} °C
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={slice}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              tickFormatter={(h) => `${h}h`}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
            />
            <YAxis domain={[18, 40]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="tOut"
              name="Outdoor"
              fill="#fef3c7"
              stroke="#d97706"
              fillOpacity={0.35}
            />
            <Line
              type="monotone"
              dataKey="tInBaseline"
              name="Baseline"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="tInMpc"
              name="ThermoLogic"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <div className="two-col">
        <section className="card chart-card">
          <h2>Humidity</h2>
          <p className="chart-desc">
            Baseline drifts toward 66% RH while idle. Ours does not.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={slice}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis domain={[40, 75]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="humidityBaseline"
                name="Baseline RH"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="humidityMpc"
                name="ThermoLogic RH"
                stroke="#0d9488"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="card chart-card">
          <h2>Tariff timing (actuation)</h2>
          <p className="chart-desc">
            MPC shifts cooling away from expensive peak hours when possible.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={slice.filter((_, i) => i % 3 === 0)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="uBaseline" name="Baseline u" fill="#cbd5e1" />
              <Bar dataKey="uMpc" name="MPC u" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="script card">
        <h2>Suggested 60–90 s demo script</h2>
        <ol>
          <li>
            “Watch the trajectory chart — ThermoLogic pre-cools ahead of this
            heatwave so we never leave the comfort band.”
          </li>
          <li>
            “Now toggle to smooth weather. Savings barely drop, because the real
            lever is tariff timing, not just the weather spike.”
          </li>
          <li>
            “Look at humidity — baseline drifts to ~66% RH while idle; ours
            stays controlled.”
          </li>
          <li>
            “Flip to Away: comfort band widens automatically. Flip the
            personalization slider: the preferred set-point shifts from user
            overrides.”
          </li>
        </ol>
      </section>
    </div>
  );
}
