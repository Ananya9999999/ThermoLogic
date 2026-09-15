import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useReveal } from "../hooks/useReveal";
import {
  OutdoorWeatherCard,
  IndoorClimateCard,
  ThermostatControlPanel,
  ScheduleOccupancyOptimizer,
} from "../components/dashboard";
import "./DashboardHome.css";

/** Signed-in home: dark glass bento — weather, comfort, thermostat, calendar */
export default function DashboardHome() {
  useReveal();
  const { user } = useAuth();

  return (
    <div className="bento-page">
      <div className="container">
        <header className="page-header reveal" style={{ marginBottom: "1.25rem" }}>
          <span className="badge badge-sage">Live dashboard</span>
          <h1>Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p>
            Outdoor feels-like from your location, indoor comfort, smart setpoint, and calendar
            pre-cool — in one view.
          </p>
        </header>

        <div className="bento-grid reveal">
          <div className="bento-cell bento-hero">
            <OutdoorWeatherCard useGeolocation glass />
          </div>
          <div className="bento-cell bento-indoor">
            <IndoorClimateCard tempC={26.5} humidity={62} demoControls />
          </div>
          <div className="bento-cell bento-thermo">
            <ThermostatControlPanel />
          </div>
          <div className="bento-cell bento-cal">
            <ScheduleOccupancyOptimizer />
          </div>
        </div>

        <Link to="/app/control" className="bento-link">
          Open Control Centre — appliances, scenarios, savings <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
