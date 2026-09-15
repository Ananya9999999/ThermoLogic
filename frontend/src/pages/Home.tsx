import { Link } from "react-router-dom";
import {
  Thermometer,
  Leaf,
  Brain,
  Calendar,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import { useReveal } from "../hooks/useReveal";
import "./Home.css";

/**
 * Public marketing landing — About, Mission, What we do.
 * Sign in / Sign up live in the top-right navbar.
 */
export default function Home() {
  useReveal();

  return (
    <div className="landing">
      <section className="land-hero reveal">
        <div className="container land-hero-inner">
          <span className="badge badge-sage">Climate-adaptive comfort</span>
          <h1>
            Thermostats that think ahead —
            <em> not after the fact</em>
          </h1>
          <p className="land-lead">
            ThermoLogic turns weather forecasts, feels-like comfort, and your calendar into
            proactive cooling that saves energy without sacrificing how the room feels.
          </p>
          <div className="land-actions">
            <Link to="/signup" className="btn btn-primary">
              Get started <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn btn-outline">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="container land-section reveal" id="mission">
        <h2>Our mission</h2>
        <p className="land-copy">
          Homes in warm, humid climates often over-cool to 20–22°C because sticky air feels worse
          than the thermometer shows. We make comfort measurable with Heat Index, then shift
          setpoints and pre-cool intelligently so families use less electricity — especially at
          peak tariff hours — without guessing.
        </p>
      </section>

      <section className="container land-section reveal" id="what-we-do">
        <h2>What we do</h2>
        <div className="land-grid">
          <article className="land-card">
            <Thermometer size={22} />
            <h3>Feels-like control</h3>
            <p>
              NWS Heat Index drives decisions so humidity is handled with Dry/low-fan bias instead of
              slamming the setpoint down.
            </p>
          </article>
          <article className="land-card">
            <Brain size={22} />
            <h3>Predictive + ML schedule</h3>
            <p>
              Short-horizon planning and an adaptive 24-hour setpoint timeline that respects thermal
              inertia and outdoor peaks.
            </p>
          </article>
          <article className="land-card">
            <Calendar size={22} />
            <h3>Calendar pre-cool</h3>
            <p>
              Link Google Calendar to detect Away / Returning Home and start efficient pre-cooling
              before you walk in.
            </p>
          </article>
          <article className="land-card">
            <Zap size={22} />
            <h3>Tariff-aware savings</h3>
            <p>
              Shift load into off-peak windows and track estimated kWh and ₹ saved versus a reactive
              22°C thermostat.
            </p>
          </article>
          <article className="land-card">
            <Leaf size={22} />
            <h3>Lower carbon impact</h3>
            <p>
              Less peak draw on the grid means lower bills and a smaller footprint for the same
              comfort band.
            </p>
          </article>
          <article className="land-card">
            <Shield size={22} />
            <h3>Physics-first design</h3>
            <p>
              Calibrated thermal models and interpretable control — not a black box that needs months
              of training data.
            </p>
          </article>
        </div>
      </section>

      <section className="container land-section reveal" id="about">
        <h2>About us</h2>
        <p className="land-copy">
          ThermoLogic started as a hackathon project focused on India&apos;s residential AC load —
          where humidity, heatwaves, and time-of-use tariffs collide. We combine open weather data,
          on-device logic, and optional calendar context so the system is practical for real homes
          and clear enough for judges and installers to trust.
        </p>
      </section>

      <section className="container land-cta reveal">
        <h2>Ready to try the live dashboard?</h2>
        <p>Create an account to see outdoor feels-like, indoor comfort, and control tools.</p>
        <Link to="/signup" className="btn btn-primary">
          Sign up free
        </Link>
      </section>
    </div>
  );
}
