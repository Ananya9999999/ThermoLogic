import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplets, MapPin, Search, Wind, Thermometer, Cloud } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ScheduleOccupancyOptimizer } from "../components/dashboard";
import WeatherScene, { resolveScene, SCENE_THEME } from "../components/dashboard/WeatherScene";
import {
  fetchByCity,
  fetchByCoords,
  getBrowserPosition,
  reverseGeocode,
  type OutdoorWeather,
} from "../components/dashboard/weatherService";
import "./DashboardHome.css";

export default function DashboardHome() {
  const { user } = useAuth();
  const isCorporate = localStorage.getItem("tl_account_kind") === "corporate";
  const [wx, setWx] = useState<OutdoorWeather | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [status, setStatus] = useState("Locating…");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const apply = useCallback((w: OutdoorWeather) => {
    setWx(w);
    setStatus(w.city);
    setError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pos = await getBrowserPosition();
        const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        const w = await fetchByCoords(pos.coords.latitude, pos.coords.longitude, label);
        if (!cancelled) apply(w);
      } catch {
        try {
          const w = await fetchByCity("Chennai");
          if (!cancelled) apply(w);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Weather unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = cityInput.trim();
    if (!q) return;
    setStatus(`Searching ${q}…`);
    try {
      apply(await fetchByCity(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "City not found");
    }
  }

  async function onGps() {
    setStatus("Locating…");
    try {
      const pos = await getBrowserPosition();
      const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      apply(await fetchByCoords(pos.coords.latitude, pos.coords.longitude, label));
    } catch (err) {
      setError(err instanceof Error ? err.message : "GPS failed");
    }
  }

  const hour = clock.getHours();
  const isNight = hour < 6 || hour >= 19;
  const conditionLabel = wx?.condition || "Clouds";
  const scene = resolveScene(conditionLabel, isNight, wx?.tempC);
  const theme = SCENE_THEME[scene];

  return (
    <WeatherScene
      tempC={wx?.tempC}
      humidity={wx?.humidity}
      condition={conditionLabel}
      isNight={isNight}
    >
      {/* Location bar — full page owns the weather */}
      <form className="dash-loc" onSubmit={onSearch}>
        <MapPin size={16} />
        <input
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder="City (London, Mumbai, Delhi…)"
        />
        <button type="submit" className="dash-loc-btn" title="Search">
          <Search size={16} />
        </button>
        <button type="button" className="dash-loc-btn" onClick={() => void onGps()} title="GPS">
          GPS
        </button>
      </form>
      {error && <p className="dash-err">{error}</p>}

      <header className="dash-hero">
        <div>
          <p className="dash-kicker">
            {theme.name.toUpperCase()} · LIVE AMBIENT
          </p>
          <h1>Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="dash-place">
            <MapPin size={14} /> {status}
            <span className="dash-clock">
              {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </p>
        </div>
      </header>

      {/* Primary weather readout — on the page, not in a nested card */}
      <div className="dash-readout">
        <div className="dash-feels">
          <span className="label">Outdoor feels-like</span>
          <span className="value">
            {wx ? `${wx.feelsLikeC.toFixed(1)}` : "—"}
            <small>°C</small>
          </span>
          <span className="cond">
            <Cloud size={16} /> {conditionLabel}
          </span>
        </div>
        <div className="dash-metrics">
          <div className="m">
            <Thermometer size={16} />
            <span className="k">Actual</span>
            <strong>{wx ? `${wx.tempC.toFixed(1)}°C` : "—"}</strong>
          </div>
          <div className="m">
            <Droplets size={16} />
            <span className="k">Humidity</span>
            <strong>{wx ? `${wx.humidity}%` : "—"}</strong>
          </div>
          <div className="m">
            <Wind size={16} />
            <span className="k">Wind</span>
            <strong>{wx ? `${Math.round(wx.windKmh)} km/h` : "—"}</strong>
          </div>
        </div>
      </div>

      {/* Calendar — home users only (not corporate industrial) */}
      {!isCorporate && (
        <div className="dash-cal-strip">
          <ScheduleOccupancyOptimizer />
        </div>
      )}

      <Link to="/app/control" className="dash-cta">
        Open Control Centre — thermostat & live feels-like <ArrowRight size={16} />
      </Link>
    </WeatherScene>
  );
}
