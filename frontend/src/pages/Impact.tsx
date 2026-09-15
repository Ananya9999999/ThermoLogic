import { Home, Building2, Cloud, BookOpen } from "lucide-react";
import { useReveal } from "../hooks/useReveal";
import "./Impact.css";

export default function Impact() {
  useReveal();

  return (
    <div className="container impact">
      <header className="page-header reveal">
        <span className="badge badge-slate">Evidence-based</span>
        <h1>Real-world impact</h1>
        <p>
          Percentage savings only matter when they translate into rupees, grid
          megawatt-hours, and tonnes of CO₂. Here is how we frame those numbers
          for Indian homes and cities.
        </p>
      </header>

      <div className="impact-grid">
        <article className="card impact-card reveal">
          <div className="icn sage"><Home size={22} /></div>
          <h2>Per household / year</h2>
          <div className="big">₹1,200 – ₹4,800</div>
          <p>
            Based on roughly 900–1,800 kWh/year of cooling (BEE-style annual
            hours, adjusted for real runtime) and DISCOM tariffs around ₹6–9/kWh.
          </p>
          <span className="tag">~10–20% energy</span>
        </article>

        <article className="card impact-card reveal reveal-delay-1">
          <div className="icn slate"><Building2 size={22} /></div>
          <h2>City scale</h2>
          <div className="big">30,000 – 70,000 MWh/year</div>
          <p>
            Illustrative mid-size metro with a few hundred thousand residential
            AC households — after diversity and adoption factors.
          </p>
        </article>

        <article className="card impact-card reveal reveal-delay-2">
          <div className="icn warm"><Cloud size={22} /></div>
          <h2>CO₂ avoided</h2>
          <div className="big">21,000 – 50,000 tCO₂/year</div>
          <p>
            Using a CEA-order Indian grid intensity of about 0.71 tCO₂ per MWh
            (recent baseline publications).
          </p>
        </article>

        <article className="card impact-card reveal reveal-delay-3">
          <div className="icn brown"><BookOpen size={22} /></div>
          <h2>Why a range?</h2>
          <p>
            Climate zone, building fabric, occupancy, star rating, and tariff
            structure all move the outcome. Our simulation reports week-level
            savings against a fair deadband baseline on identical weather —
            not a marketing ceiling.
          </p>
        </article>
      </div>

      <section className="card method reveal">
        <h2>Transparent methodology</h2>
        <ul>
          <li>BEE ISEER labels assume on the order of 1,600 operating hours/year as a reference.</li>
          <li>Real homes often run longer in peak summer; we show a band, not a single point.</li>
          <li>Tariffs vary by state and slab; peak hours make timing-aware control more valuable.</li>
          <li>CO₂ uses published grid average intensity — update when CEA releases newer figures.</li>
          <li>Controller comparison always uses the same building model and weather trace.</li>
        </ul>
      </section>
    </div>
  );
}
