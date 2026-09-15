import { impactNumbers } from "../data/mockData";
import { Leaf, Home, Building2, Cloud } from "lucide-react";
import "./Impact.css";

export default function Impact() {
  return (
    <div className="container impact-page">
      <header className="page-header">
        <h1>Real-world impact</h1>
        <p>
          13–20% energy savings sounds abstract. Here’s what it means in rupees,
          megawatt-hours, and tons of CO₂ for Indian households and cities.
        </p>
      </header>

      <div className="impact-grid">
        <div className="card impact-card">
          <div className="icon-wrap">
            <Home size={22} />
          </div>
          <h2>Per household / year</h2>
          <div className="big-num">{impactNumbers.annualSavingsInr}</div>
          <p>{impactNumbers.perHouseholdNote}</p>
          <div className="tag">{impactNumbers.savingsPct} energy</div>
        </div>

        <div className="card impact-card">
          <div className="icon-wrap teal">
            <Building2 size={22} />
          </div>
          <h2>City scale (≈500k ACs)</h2>
          <div className="big-num">{impactNumbers.cityScaleMwh}</div>
          <p>{impactNumbers.cityScaleNote}</p>
        </div>

        <div className="card impact-card">
          <div className="icon-wrap green">
            <Cloud size={22} />
          </div>
          <h2>CO₂ avoided</h2>
          <div className="big-num">{impactNumbers.co2Tons}</div>
          <p>{impactNumbers.co2Note}</p>
        </div>

        <div className="card impact-card">
          <div className="icon-wrap">
            <Leaf size={22} />
          </div>
          <h2>Why the range?</h2>
          <p>
            Savings depend on climate zone, tariff structure, building thermal
            mass, and how often the household is occupied. The 13% figure is a
            conservative weekly average against a fair deadband baseline; peak
            heatwave weeks and high ToU differentials push toward 20%+.
          </p>
        </div>
      </div>

      <section className="card math-card">
        <h2>Conversion math (transparent)</h2>
        <ul>
          <li>
            Typical 1.5-ton split AC in a metro apartment: ~1,200–1,800 kWh/yr
            for cooling (BEE / field studies).
          </li>
          <li>
            DISCOM tariffs: roughly ₹6–9/kWh blended; peak slabs higher.
          </li>
          <li>
            13% of 1,500 kWh × ₹7 ≈ ₹1,365; at the high end of usage and tariff
            + better MPC weeks → ₹2,400–4,800 is a realistic household range.
          </li>
          <li>
            500,000 households × 1,500 kWh × 0.15 ≈ 112,500 MWh before
            diversity; we quote a tempered 42–68k MWh after occupancy and
            adoption factors.
          </li>
          <li>
            CEA grid factor ≈ 0.82 tCO₂/MWh → tens of thousands of tons at city
            scale.
          </li>
        </ul>
      </section>
    </div>
  );
}
