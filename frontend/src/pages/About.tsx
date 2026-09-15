import { Target, Lightbulb, Users, Heart } from "lucide-react";
import { useReveal } from "../hooks/useReveal";
import "./About.css";

export default function About() {
  useReveal();

  return (
    <div className="container about">
      <header className="page-header reveal">
        <span className="badge badge-sage">Our story</span>
        <h1>About ThermoLogic</h1>
        <p>
          We are building climate control that respects both how people live and
          how the grid prices energy — starting with a clear, fair demonstration
          against ordinary thermostats.
        </p>
      </header>

      <div className="about-grid">
        <article className="card about-card reveal">
          <div className="icn sage"><Target size={22} /></div>
          <h2>Mission</h2>
          <p>
            Reduce residential cooling waste in India without asking households
            to accept muggy air or constant setpoint fiddling. Planning with
            weather and tariffs should feel invisible — only the bill and the
            comfort should change.
          </p>
        </article>
        <article className="card about-card reveal reveal-delay-1">
          <div className="icn slate"><Lightbulb size={22} /></div>
          <h2>Approach</h2>
          <p>
            Same physics for baseline and ThermoLogic. Transparent metrics.
            A product surface that tells the story in under two minutes — because
            a good controller that nobody understands will not ship.
          </p>
        </article>
        <article className="card about-card reveal reveal-delay-2">
          <div className="icn warm"><Users size={22} /></div>
          <h2>Team</h2>
          <p>
            A small hackathon team across control, energy systems, and design.
            We care as much about the three-minute pitch as about the solver —
            judges and future users both need clarity.
          </p>
        </article>
        <article className="card about-card reveal reveal-delay-3">
          <div className="icn brown"><Heart size={22} /></div>
          <h2>Values</h2>
          <p>
            Fair baselines over strawmen. Humidity as comfort, not an
            afterthought. Impact in rupees and tonnes, not only percentages.
            Security and privacy by default for anything that touches the home.
          </p>
        </article>
      </div>

      <section className="card beliefs reveal">
        <h2>What we believe</h2>
        <ul>
          <li>Reactive thermostats waste energy and comfort because they have no model of the near future.</li>
          <li>Tariff timing is often as important as the weather spike itself.</li>
          <li>Occupancy-aware bands answer “what if nobody is home?” before it becomes an objection.</li>
          <li>A demo should be honest about simulation limits and clear about what is live data.</li>
        </ul>
      </section>
    </div>
  );
}
