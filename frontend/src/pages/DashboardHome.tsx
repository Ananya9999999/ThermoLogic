import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useReveal } from "../hooks/useReveal";
import { OutdoorWeatherCard } from "../components/dashboard";
import IndoorClimateCard from "../components/dashboard/IndoorClimateCard";
import * as api from "../api";
import "./DashboardHome.css";

/**
 * Dashboard: live outdoor weather + indoor estimate from backend predict.
 * Thermostat + calendar live only on Control Centre (/app/control).
 */
export default function DashboardHome() {
  useReveal();
  const { user } = useAuth();
  const [indoor, setIndoor] = useState<{ temp: number; humidity: number; band: [number, number] } | null>(null);
  const [status, setStatus] = useState("Loading live indoor estimate…");
  const [err, setErr] = useState("");

  async function loadIndoor() {
    setErr("");
    setStatus("Fetching live forecast & ML indoor estimate…");
    try {
      // Prefer appliance-linked predict; fallback to catalog-free predict
      let body: Record<string, unknown> = {
        mode: "smooth",
        use_live_weather: true,
        hours: 24,
        policy: "mpc",
      };
      try {
        const apps = await api.listAppliances();
        const first = apps.find((a) => a.enabled !== false) || apps[0];
        if (first) body = { ...body, appliance_id: first.id };
      } catch {
        /* not critical */
      }
      const pred = await api.runPredict(body);
      const pts = pred.points || [];
      const last = pts[Math.min(pts.length - 1, 3)] || pts[0];
      if (!last) throw new Error("No prediction points returned");
      setIndoor({
        temp: Number(last.t_in_pred),
        humidity: Number(last.humidity_pred),
        band: [pred.recommended_setpoint.t_min, pred.recommended_setpoint.t_max],
      });
      setStatus(
        `${pred.weather_source === "live" ? "Live weather" : pred.weather_source} · ${pred.city} · ML indoor estimate`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load indoor estimate");
      setStatus("");
      setIndoor(null);
    }
  }

  useEffect(() => {
    loadIndoor();
  }, []);

  return (
    <div className="bento-page">
      <div className="container">
        <header className="page-header reveal" style={{ marginBottom: "1.25rem" }}>
          <span className="badge badge-sage">Live dashboard</span>
          <h1>Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p>
            Live outdoor weather for your location and an ML indoor estimate from the live forecast.
            Thermostat and calendar are only on Control Centre — not duplicated here.
          </p>
        </header>

        <div className="dash-two-col reveal">
          <div className="bento-cell dash-weather">
            <OutdoorWeatherCard useGeolocation glass />
          </div>
          <div className="bento-cell dash-indoor">
            {indoor ? (
              <IndoorClimateCard
                tempC={indoor.temp}
                humidity={indoor.humidity}
                comfortMin={indoor.band[0]}
                comfortMax={indoor.band[1]}
                demoControls={false}
              />
            ) : (
              <div className="dash-indoor-loading">
                <p>{err || status || "Loading…"}</p>
                <button type="button" className="btn btn-outline" onClick={loadIndoor}>
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            )}
            {status && indoor && <p className="dash-status">{status}</p>}
            {err && <p className="dash-err">{err}</p>}
          </div>
        </div>

        <Link to="/app/control" className="bento-link">
          Open Control Centre — thermostat, calendar, appliances, ML charts{" "}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
