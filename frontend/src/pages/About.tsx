import { Users, Target, Lightbulb } from "lucide-react";
import "./About.css";

export default function About() {
  return (
    <div className="container about-page">
      <header className="page-header">
        <h1>About Us</h1>
        <p>
          ThermoLogic is a hackathon project built to show that smart
          thermostats can be more than remote controls — they can plan.
        </p>
      </header>

      <div className="about-grid">
        <div className="card about-card">
          <div className="icon-wrap">
            <Target size={22} />
          </div>
          <h2>Mission</h2>
          <p>
            Cut residential HVAC energy use in India without sacrificing
            comfort. We use forecast-aware model predictive control so the
            system pre-cools before heatwaves, shifts load off peak tariffs, and
            keeps humidity from drifting while the unit is idle.
          </p>
        </div>

        <div className="card about-card">
          <div className="icon-wrap teal">
            <Lightbulb size={22} />
          </div>
          <h2>Approach</h2>
          <p>
            Same building physics for both the ordinary deadband thermostat and
            our MPC. Fair comparison, transparent metrics, and a dashboard that
            tells the story in under two minutes — trajectory, humidity,
            tariff, and real-world rupees and CO₂.
          </p>
        </div>

        <div className="card about-card">
          <div className="icon-wrap green">
            <Users size={22} />
          </div>
          <h2>Team</h2>
          <p>
            Built by a small hackathon team focused on control, energy systems,
            and clean product design. We care about judges understanding the
            idea in a 3-minute pitch as much as about the solver itself.
          </p>
        </div>
      </div>

      <section className="card values">
        <h2>What we believe</h2>
        <ul>
          <li>
            Reactive thermostats waste energy and comfort because they have no
            model of the future.
          </li>
          <li>
            Humidity is part of comfort; ignoring it produces “efficient”
            controllers that feel muggy.
          </li>
          <li>
            Real impact is measured in ₹ per household and tons of CO₂ at city
            scale — not only in percentage points on a chart.
          </li>
          <li>
            A fair baseline (deadband hysteresis, same weather, same building)
            is the only way to claim a real improvement.
          </li>
        </ul>
      </section>
    </div>
  );
}
