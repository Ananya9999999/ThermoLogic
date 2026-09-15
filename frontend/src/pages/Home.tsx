import { Link } from "react-router-dom";
import { ArrowRight, Thermometer, Leaf, Shield } from "lucide-react";
import { useReveal } from "../hooks/useReveal";
import "./Home.css";

export default function Home() {
  useReveal();

  return (
    <div className="container home-public">
      <section className="hero-public reveal">
        <div className="hero-orb" aria-hidden />
        <span className="badge badge-olive">Forecast-aware comfort</span>
        <h1>Climate control that plans ahead</h1>
        <p className="lead">
          ThermoLogic pre-cools before heatwaves, shifts load off peak tariffs,
          and keeps humidity in check — for every AC and zone in your home.
        </p>
        <div className="hero-actions">
          <Link to="/signup" className="btn btn-primary">
            Create free account <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn btn-outline">
            Sign in
          </Link>
        </div>
        <p className="hero-note">Home is public. Live dashboard, appliances &amp; calculator require sign-in.</p>
      </section>

      <section className="feature-row">
        <article className="card feature reveal">
          <Thermometer size={22} />
          <h3>Multi-appliance</h3>
          <p>Add split ACs, heaters, heat pumps — each with its own comfort band.</p>
        </article>
        <article className="card feature reveal reveal-delay-1">
          <Leaf size={22} />
          <h3>Savings you can tune</h3>
          <p>Live graphs and an annual calculator grounded in BEE-style and CEA factors.</p>
        </article>
        <article className="card feature reveal reveal-delay-2">
          <Shield size={22} />
          <h3>Secure by default</h3>
          <p>Accounts, JWT sessions, and server-side weather keys — never in the browser.</p>
        </article>
      </section>
    </div>
  );
}
