import {
  CloudSun,
  Box,
  Cpu,
  Radio,
  LayoutDashboard,
  Droplets,
  ArrowRight,
} from "lucide-react";
import "./Architecture.css";

const stages = [
  {
    icon: CloudSun,
    title: "Forecast",
    desc: "Weather API (OpenWeatherMap behind feature flag) + tariff schedule. Synthetic generator for offline demos.",
  },
  {
    icon: Box,
    title: "Thermal model",
    desc: "Lumped R-C building model with internal gains. Same physics for baseline and MPC.",
  },
  {
    icon: Cpu,
    title: "MPC / LP",
    desc: "Finite-horizon optimizer minimizes cost subject to comfort band, power limits, and humidity coupling.",
  },
  {
    icon: Radio,
    title: "Actuation",
    desc: "Cooling / heating commands to the HVAC. Bang-bang or modulated depending on hardware.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    desc: "Live trajectory, humidity, cost, and scenario toggles for judges and end users.",
  },
];

export default function Architecture() {
  return (
    <div className="container arch-page">
      <header className="page-header">
        <h1>Architecture</h1>
        <p>
          One-page view: forecast → thermal model → MPC/LP → actuation →
          dashboard. Humidity is a first-class constraint, not an afterthought.
        </p>
      </header>

      <div className="pipeline">
        {stages.map((s, i) => (
          <div key={s.title} className="stage-wrap">
            <div className="stage card">
              <div className="stage-icon">
                <s.icon size={22} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
            {i < stages.length - 1 && (
              <div className="arrow">
                <ArrowRight size={20} />
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="card humidity-callout">
        <div className="hum-icon">
          <Droplets size={24} />
        </div>
        <div>
          <h2>Humidity coupling (called out)</h2>
          <p>
            Latent load is modeled so the optimizer doesn’t “save energy” by
            shutting the coil off for long idle stretches that let RH climb.
            The baseline reactive thermostat has no such notion — it only reacts
            to dry-bulb temperature — which is why it drifts to ~66% RH while
            ThermoLogic stays controlled.
          </p>
        </div>
      </section>

      <section className="card next-steps">
        <h2>Natural next steps (pitch-ready)</h2>
        <ul>
          <li>
            <strong>Multi-zone</strong> — same LP, more variables (bedroom /
            living room) with a shared energy budget.
          </li>
          <li>
            <strong>Real weather API</strong> — OpenWeatherMap behind a feature
            flag; live city data for the demo.
          </li>
          <li>
            <strong>Occupancy-aware bands</strong> — calendar or “Away” toggle
            widens comfort when nobody is expected home.
          </li>
          <li>
            <strong>Personalization</strong> — slider / override history nudges
            the preferred band (stub already in Live Demo).
          </li>
          <li>
            <strong>Future</strong> — scenario-based robust MPC; demand-response
            signals from the utility.
          </li>
        </ul>
      </section>
    </div>
  );
}
