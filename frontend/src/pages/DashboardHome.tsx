import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useReveal } from "../hooks/useReveal";
import {
  OutdoorWeatherCard,
  ScheduleOccupancyOptimizer,
} from "../components/dashboard";
import "./DashboardHome.css";

/** Dashboard: outdoor weather + calendar. Thermostat / indoor ML stay on Control Centre. */
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
            Live outdoor conditions and calendar-based occupancy / pre-cool schedule.
            Thermostat and indoor ML forecast are on Control Centre.
          </p>
        </header>

        <div className="dash-two-col reveal">
          <div className="bento-cell dash-weather">
            <OutdoorWeatherCard useGeolocation glass />
          </div>
          <div className="bento-cell dash-cal">
            <ScheduleOccupancyOptimizer />
          </div>
        </div>

        <Link to="/app/control" className="bento-link">
          Open Control Centre — thermostat, indoor feels-like, appliances{" "}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}