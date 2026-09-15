import { Link } from "react-router-dom";
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
} from "recharts";
import {
  Zap,
  Thermometer,
  Droplets,
  TrendingDown,
  Play,
  ArrowRight,
} from "lucide-react";
import { heatwaveData, computeMetrics } from "../data/mockData";
import "./Dashboard.css";

const metrics = computeMetrics(heatwaveData);
// Show a 48h window around the heatwave for the sparkline
const chartSlice = heatwaveData.slice(60, 120).map((d) => ({
  ...d,
  label: `H${d.hour}`,
}));

export default function Dashboard() {
  return (
    <div className="container dashboard">
      <section className="hero">
        <div className="hero-text">
          <span className="badge badge-primary">Hackathon Demo</span>
          <h1>ThermoLogic</h1>
          <p className="hero-sub">
            Forecast-aware Model Predictive Control that pre-cools ahead of
            heatwaves, respects tariff peaks, and keeps humidity in band —
            beating reactive thermostats on both comfort and cost.
          </p>
          <div className="hero-actions">
            <Link to="/demo" className="btn btn-primary">
              <Play size={16} /> Run live demo
            </Link>
            <Link to="/impact" className="btn btn-outline">
              See real-world impact <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <Zap size={20} className="stat-icon" />
            <div>
              <div className="stat-value">{metrics.savingsPct}%</div>
              <div className="stat-label">Energy savings</div>
            </div>
          </div>
          <div className="stat-card">
            <Thermometer size={20} className="stat-icon accent" />
            <div>
              <div className="stat-value">{metrics.comfortMpc}%</div>
              <div className="stat-label">Comfort compliance</div>
            </div>
          </div>
          <div className="stat-card">
            <Droplets size={20} className="stat-icon teal" />
            <div>
              <div className="stat-value">{metrics.avgHumMpc}% RH</div>
              <div className="stat-label">Avg humidity (ours)</div>
            </div>
          </div>
          <div className="stat-card">
            <TrendingDown size={20} className="stat-icon green" />
            <div>
              <div className="stat-value">₹{metrics.costBase - metrics.costMpc}</div>
              <div className="stat-label">Saved this week</div>
            </div>
          </div>
        </div>
      </section>

      <section className="chart-section card">
        <div className="section-header">
          <h2>Temperature trajectory — heatwave week</h2>
          <p>
            Watch the MPC pre-cool before the outdoor spike. Baseline waits for
            a breach and overshoots.
          </p>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartSlice} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => `${h}h`}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                domain={[18, 42]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                unit="°C"
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="tOut"
                name="Outdoor"
                fill="#fef3c7"
                stroke="#d97706"
                strokeWidth={1.5}
                fillOpacity={0.4}
              />
              <Line
                type="monotone"
                dataKey="tInBaseline"
                name="Baseline (reactive)"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="tInMpc"
                name="ThermoLogic MPC"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-note">
          Comfort band shaded conceptually at 22–26 °C. Baseline compliance{" "}
          <strong>{metrics.comfortBase}%</strong> · MPC{" "}
          <strong>{metrics.comfortMpc}%</strong>.
        </div>
      </section>

      <section className="features-grid">
        <div className="card feature">
          <h3>Tariff-aware</h3>
          <p>
            Optimizes against time-of-use prices. Toggle to smooth weather and
            savings barely drop — because the real win is shifting load off
            peak.
          </p>
        </div>
        <div className="card feature">
          <h3>Humidity coupling</h3>
          <p>
            Baseline drifts to ~66% RH while idle. ThermoLogic keeps the coil
            active enough that humidity stays in a healthy band.
          </p>
        </div>
        <div className="card feature">
          <h3>Same physics, fair fight</h3>
          <p>
            Both controllers see identical weather, building R/C, gains and
            power limits. The only difference is planning vs reacting.
          </p>
        </div>
      </section>
    </div>
  );
}
