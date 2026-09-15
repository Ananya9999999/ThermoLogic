import { Link } from "react-router-dom";
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
} from "recharts";
import {
  Zap,
  Thermometer,
  Droplets,
  Leaf,
  ArrowRight,
  Play,
  Shield,
  Clock,
} from "lucide-react";
import { heatwaveData, computeMetrics } from "../data/mockData";
import { useReveal } from "../hooks/useReveal";
import "./Dashboard.css";

const metrics = computeMetrics(heatwaveData);
const chartSlice = heatwaveData.slice(60, 120);

export default function Dashboard() {
  useReveal();

  return (
    <div className="container home">
      <section className="hero reveal">
        <div className="hero-copy">
          <span className="badge badge-sage">Intelligent climate control</span>
          <h1>Comfort that thinks ahead</h1>
          <p className="hero-lead">
            ThermoLogic uses weather forecasts and tariff timing to pre-cool
            your home before heat arrives — so you stay comfortable without
            the waste of a reactive thermostat.
          </p>
          <div className="hero-actions">
            <Link to="/demo" className="btn btn-primary">
              <Play size={16} /> Experience the demo
            </Link>
            <Link to="/impact" className="btn btn-outline">
              See the impact <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hero-metrics reveal reveal-delay-1">
          <div className="metric-tile">
            <Zap size={18} />
            <div>
              <strong>{metrics.savingsPct}%</strong>
              <span>Energy savings</span>
            </div>
          </div>
          <div className="metric-tile">
            <Thermometer size={18} />
            <div>
              <strong>{metrics.comfortMpc}%</strong>
              <span>Comfort compliance</span>
            </div>
          </div>
          <div className="metric-tile">
            <Droplets size={18} />
            <div>
              <strong>{metrics.avgHumMpc}% RH</strong>
              <span>Humidity held steady</span>
            </div>
          </div>
          <div className="metric-tile">
            <Leaf size={18} />
            <div>
              <strong>₹{metrics.costBase - metrics.costMpc}</strong>
              <span>Saved this week (sim)</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card chart-panel reveal reveal-delay-2">
        <div className="panel-head">
          <h2>Heatwave week — temperature trajectory</h2>
          <p>
            Outdoor temperature rises; ThermoLogic pre-cools. A reactive
            baseline waits for a breach and overshoots the comfort band.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartSlice} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8a7c74" }} tickFormatter={(h) => `${h}h`} />
            <YAxis domain={[18, 42]} tick={{ fontSize: 11, fill: "#8a7c74" }} unit="°C" />
            <Tooltip
              contentStyle={{
                background: "#faf7f7",
                border: "1px solid #d4cbcc",
                borderRadius: 12,
                fontSize: 13,
              }}
            />
            <Legend />
            <Area type="monotone" dataKey="tOut" name="Outdoor" fill="#dab692" stroke="#8f5b34" fillOpacity={0.35} />
            <Line type="monotone" dataKey="tInBaseline" name="Baseline reactive" stroke="#8a9ea7" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="tInMpc" name="ThermoLogic" stroke="#8d9b6a" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section className="pillars">
        <article className="card pillar reveal">
          <div className="pillar-icon sage"><Clock size={22} /></div>
          <h3>Forecast, not reaction</h3>
          <p>
            We cool gently before the outdoor spike — not after the room has
            already left your comfort band.
          </p>
        </article>
        <article className="card pillar reveal reveal-delay-1">
          <div className="pillar-icon slate"><Zap size={22} /></div>
          <h3>Tariff-aware timing</h3>
          <p>
            Load shifts toward off-peak hours when the physics allows — so
            savings hold even on mild weather weeks.
          </p>
        </article>
        <article className="card pillar reveal reveal-delay-2">
          <div className="pillar-icon warm"><Shield size={22} /></div>
          <h3>Humidity as a first-class goal</h3>
          <p>
            Idle stretch strategies that ignore latent load leave air muggy.
            ThermoLogic keeps RH from drifting while saving energy.
          </p>
        </article>
      </section>

      <section className="cta-band reveal">
        <div>
          <h2>Ready for a walkthrough?</h2>
          <p>
            The live demo includes heatwave and smooth scenarios, occupancy
            modes, and a short pitch script for judges.
          </p>
        </div>
        <Link to="/demo" className="btn btn-warm">
          Open live demo <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
