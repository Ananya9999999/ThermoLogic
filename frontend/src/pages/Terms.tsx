import "./Terms.css";

export default function Terms() {
  return (
    <div className="container terms-page">
      <header className="page-header">
        <h1>Terms & Conditions</h1>
        <p>Last updated: September 2026</p>
      </header>

      <div className="card terms-body">
        <section>
          <h2>1. Nature of the project</h2>
          <p>
            ThermoLogic is a demonstration and research prototype built for a
            hackathon. It is not a certified commercial product, not a medical
            device, and not a substitute for professional HVAC design or
            building code compliance.
          </p>
        </section>

        <section>
          <h2>2. Simulation & estimates</h2>
          <p>
            Energy savings percentages, rupee figures, MWh totals, and CO₂
            estimates shown in the dashboard are derived from simplified thermal
            models, synthetic or sample weather traces, and publicly available
            tariff and emission factors. Actual results in a real building will
            differ. Do not treat any number on this site as a guarantee of
            savings or environmental impact.
          </p>
        </section>

        <section>
          <h2>3. No liability</h2>
          <p>
            The authors and presenters accept no liability for decisions made on
            the basis of this demo, including but not limited to equipment
            purchases, tariff plan changes, or comfort settings in occupied
            spaces.
          </p>
        </section>

        <section>
          <h2>4. Third-party data</h2>
          <p>
            Weather data (when a live API is enabled) is provided by third
            parties such as OpenWeatherMap and is subject to their terms. Tariff
            and emission factors are illustrative averages and may not match
            your DISCOM or the latest CEA publication.
          </p>
        </section>

        <section>
          <h2>5. Intellectual property</h2>
          <p>
            Code, UI, and documentation created for this hackathon remain the
            property of the team unless otherwise agreed with the event
            organizers. You may view and discuss the demo; redistribution or
            commercial use requires prior written permission.
          </p>
        </section>

        <section>
          <h2>6. Privacy</h2>
          <p>
            This frontend does not collect personal data, account credentials,
            or occupancy calendars by default. Any “Away” or personalization
            controls are local to your browser session for demonstration only.
          </p>
        </section>

        <section>
          <h2>7. Contact</h2>
          <p>
            For questions about the demo or these terms, contact the ThermoLogic
            team via the channels provided at the hackathon event.
          </p>
        </section>
      </div>
    </div>
  );
}
