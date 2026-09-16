/**
 * Live dynamic control: room simulators, feels-like remote (min–max),
 * controller decision drives the remote unless Force is on,
 * 24h plan grouped by time-of-day with outdoor data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateHeatIndex, comfortStatus } from "./heatIndex";
import * as api from "../../api";
import type { LiveControlResult } from "../../api";
import "./LiveControlPanel.css";

const PERIOD_ORDER = ["early_morning", "morning", "noon", "evening", "night"] as const;

const PERIOD_META: Record<
  string,
  { label: string; hours: string; color: string; text: string }
> = {
  early_morning: { label: "Early morning", hours: "4–7", color: "#f8d5e0", text: "#6b3a4a" },
  morning: { label: "Morning", hours: "7–11", color: "#cfe8f8", text: "#2a4a6b" },
  noon: { label: "Noon", hours: "11–15", color: "#f5b8a8", text: "#6b2a1a" },
  evening: { label: "Evening", hours: "15–20", color: "#ddd0f0", text: "#3a2a5a" },
  night: { label: "Night", hours: "20–4", color: "#3d2a55", text: "#f0e8f8" },
};

const FEATURE_HELP: Record<string, string> = {
  feels:
    "Feels-like uses the NWS Heat Index. It combines dry-bulb temperature and humidity so the controller can choose Cool vs Dry.",
  remote:
    "This remote sets your comfort range (min–max feels-like). In Auto, the controller decision moves the dial and range. Turn Force on to lock the remote so only you can change it.",
  dry: "Dry mode removes moisture with moderate compressor power instead of over-cooling when humidity drives discomfort.",
  plan: "24-hour plan from outdoor forecast + your period ranges. Coloured by time of day. Each cell shows outdoor temp and planned mode.",
  profiles: "Saved feels-like ranges per period (14-day memory). Used when Force is off.",
};

type Props = {
  outdoorTemp?: number | null;
  outdoorHumidity?: number | null;
  city?: string | null;
  onDecision?: (d: LiveControlResult) => void;
};

function dialColor(feels: number): string {
  if (feels < 22) return "#5b8fd4";
  if (feels < 24) return "#6bb3a0";
  if (feels < 26.5) return "#8d9b6a";
  if (feels < 28.5) return "#d4a04a";
  return "#c45c4a";
}

export default function LiveControlPanel({
  outdoorTemp = 32,
  outdoorHumidity = 60,
  city,
  onDecision,
}: Props) {
  const [rawTemp, setRawTemp] = useState(26.0);
  const [humidity, setHumidity] = useState(58);

  // Remote range (feels-like min–max)
  const [rangeMin, setRangeMin] = useState(23.0);
  const [rangeMax, setRangeMax] = useState(26.0);
  const [forceOn, setForceOn] = useState(false);
  const [forceHvac, setForceHvac] = useState<"auto" | "cool" | "dry" | "heat" | "idle">("auto");

  const [decision, setDecision] = useState<LiveControlResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [helpKey, setHelpKey] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<api.ComfortProfiles | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState("");
  const [editPeriod, setEditPeriod] = useState("evening");

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const feelsLocal = useMemo(() => calculateHeatIndex(rawTemp, humidity), [rawTemp, humidity]);
  const status = comfortStatus(feelsLocal, humidity);

  // Dial shows midpoint of active range (or decision target when auto)
  const dialValue = useMemo(() => {
    if (!forceOn && decision) {
      return (decision.feels_min + decision.feels_max) / 2;
    }
    return (rangeMin + rangeMax) / 2;
  }, [forceOn, decision, rangeMin, rangeMax]);

  const run = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const body: api.LiveControlBody = {
        room_temp_c: rawTemp,
        room_humidity: humidity,
        outdoor_temp: outdoorTemp ?? undefined,
        outdoor_humidity: outdoorHumidity ?? undefined,
        force_mode: forceOn && forceHvac !== "auto" ? forceHvac : "auto",
        // Only lock the comfort band when Force is on (user owns the remote)
        force_feels_min: forceOn ? rangeMin : undefined,
        force_feels_max: forceOn ? rangeMax : undefined,
        include_forecast: true,
        city: city ?? undefined,
      };
      const res = await api.runLiveControl(body);
      setDecision(res);
      // Auto: dial reads decision band (see dialValue). Do not write
      // range state here or we create a request loop.
      onDecision?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live control failed");
    } finally {
      setBusy(false);
    }
  }, [
    rawTemp,
    humidity,
    outdoorTemp,
    outdoorHumidity,
    forceOn,
    forceHvac,
    rangeMin,
    rangeMax,
    city,
    onDecision,
  ]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void run();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [run]);

  useEffect(() => {
    tickRef.current = setInterval(() => void run(), 45_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [run]);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.fetchComfortProfiles();
        setProfiles(p.profiles);
        setCurrentPeriod(p.current_period);
        setEditPeriod(p.current_period || "evening");
        if (!forceOn && p.profiles[p.current_period]) {
          setRangeMin(p.profiles[p.current_period].feels_min);
          setRangeMax(p.profiles[p.current_period].feels_max);
        }
      } catch {
        /* guest */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    if (!profiles) return;
    try {
      const res = await api.saveComfortProfiles({
        [editPeriod]: {
          ...profiles[editPeriod],
          feels_min: rangeMin,
          feels_max: rangeMax,
        },
      });
      setProfiles(res.profiles);
      setCurrentPeriod(res.current_period);
      void run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  // Group day_plan by period
  const planByPeriod = useMemo(() => {
    const map: Record<string, LiveControlResult["day_plan"]> = {
      early_morning: [],
      morning: [],
      noon: [],
      evening: [],
      night: [],
    };
    for (const d of decision?.day_plan || []) {
      const p = d.period in map ? d.period : "night";
      map[p].push(d);
    }
    return map;
  }, [decision]);

  const modeColor =
    decision?.mode === "dry"
      ? "#5b8a8a"
      : decision?.mode === "cool"
        ? "#4a7c9b"
        : decision?.mode === "heat"
          ? "#b86b3a"
          : "#8a9a7a";

  const arcPct = Math.max(0, Math.min(1, (dialValue - 18) / (32 - 18)));
  const stroke = dialColor(dialValue);

  return (
    <div className="lcp card">
      <div className="lcp-head">
        <h2>Live room control</h2>
        <p>
          Change room conditions or the comfort range — the controller re-decides immediately.
          With Force off, the remote follows the controller.
        </p>
      </div>

      <div className="lcp-top">
        {/* Room simulation */}
        <div className="lcp-sim">
          <div className="lcp-section-title">
            Room state (demo)
            <button type="button" className="lcp-info" onClick={() => setHelpKey("feels")}>
              ?
            </button>
          </div>
          <label className="lcp-slider">
            <span>
              Raw temperature <strong>{rawTemp.toFixed(1)}°C</strong>
            </span>
            <input
              type="range"
              min={18}
              max={34}
              step={0.5}
              value={rawTemp}
              onChange={(e) => setRawTemp(+e.target.value)}
            />
          </label>
          <label className="lcp-slider">
            <span>
              Humidity <strong>{humidity.toFixed(0)}%</strong>
            </span>
            <input
              type="range"
              min={30}
              max={90}
              step={1}
              value={humidity}
              onChange={(e) => setHumidity(+e.target.value)}
            />
          </label>
          <div className="lcp-feels-row">
            <div className="lcp-feels">
              <span className="k">Feels-like now</span>
              <span className="v">{feelsLocal.toFixed(1)}°C</span>
            </div>
            <div className={`lcp-status s-${status.replace(/\s/g, "").toLowerCase()}`}>{status}</div>
          </div>
        </div>

        {/* Remote */}
        <div className="lcp-remote">
          <div className="lcp-section-title">
            Thermostat · feels-like range
            <button type="button" className="lcp-info" onClick={() => setHelpKey("remote")}>
              ?
            </button>
            {forceOn ? (
              <span className="lcp-force-tag">FORCE ON</span>
            ) : (
              <span className="lcp-auto-tag">AUTO · follows controller</span>
            )}
          </div>

          <div className="lcp-dial" aria-hidden>
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#eee6da" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke={stroke}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${arcPct * 301} 301`}
                transform="rotate(-90 60 60)"
                className="lcp-dial-arc"
              />
            </svg>
            <div className="lcp-dial-center">
              <span className="big" style={{ color: stroke }}>
                {dialValue.toFixed(1)}
              </span>
              <span className="unit">°C mid</span>
            </div>
          </div>

          <div className="lcp-range-inputs">
            <label>
              Feels min
              <input
                type="number"
                step={0.5}
                min={18}
                max={30}
                value={forceOn || !decision ? rangeMin : decision.feels_min}
                onChange={(e) => {
                  const v = +e.target.value;
                  setForceOn(true);
                  setRangeMin(v);
                  if (v >= rangeMax) setRangeMax(v + 1);
                }}
              />
            </label>
            <label>
              Feels max
              <input
                type="number"
                step={0.5}
                min={20}
                max={34}
                value={forceOn || !decision ? rangeMax : decision.feels_max}
                onChange={(e) => {
                  const v = +e.target.value;
                  setForceOn(true);
                  setRangeMax(v);
                  if (v <= rangeMin) setRangeMin(v - 1);
                }}
              />
            </label>
          </div>
          <p className="lcp-range-hint">
            Active band:{" "}
            <strong>
              {(forceOn || !decision ? rangeMin : decision.feels_min).toFixed(1)} –{" "}
              {(forceOn || !decision ? rangeMax : decision.feels_max).toFixed(1)}°C
            </strong>{" "}
            feels-like
            {!forceOn && " · editing a number turns Force on"}
          </p>

          <label className="lcp-force-toggle">
            <input type="checkbox" checked={forceOn} onChange={(e) => setForceOn(e.target.checked)} />
            Force mode — lock remote (controller cannot change range)
          </label>

          {forceOn && (
            <div className="lcp-modes">
              {(["auto", "cool", "dry", "heat", "idle"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={forceHvac === m ? "on" : ""}
                  onClick={() => setForceHvac(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controller decision */}
        <div className="lcp-decision">
          <div className="lcp-section-title">
            Controller decision {busy && <span className="lcp-busy">updating…</span>}
            <button type="button" className="lcp-info" onClick={() => setHelpKey("dry")}>
              ?
            </button>
          </div>
          {error && <div className="lcp-error">{error}</div>}
          {decision && (
            <>
              <div className="lcp-mode-badge" style={{ borderColor: modeColor, color: modeColor }}>
                {decision.mode.toUpperCase()}
                <span>{Math.round(decision.power_fraction * 100)}% power</span>
              </div>
              <p className="lcp-reason">{decision.reason}</p>
              <p className="lcp-energy">{decision.energy_hint}</p>
              <div className="lcp-metrics">
                <div>
                  <span className="k">Target dry-bulb</span>
                  <span className="v">{decision.target_dry_bulb_c}°C</span>
                </div>
                <div>
                  <span className="k">Decision band</span>
                  <span className="v">
                    {decision.feels_min}–{decision.feels_max}°C
                  </span>
                </div>
                <div>
                  <span className="k">Room feels</span>
                  <span className="v">{decision.current_feels_c}°C</span>
                </div>
              </div>
              <div className="lcp-section-title">Next 6 hours</div>
              <div className="lcp-plan">
                {decision.plan_next_6h.map((p) => (
                  <div key={p.hour_offset} className={`lcp-plan-cell mode-${p.mode}`}>
                    <span className="h">+{p.hour_offset}h</span>
                    <span className="m">{p.mode}</span>
                    <span className="f">{p.target_feels}°</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Profiles */}
      <div className="lcp-profiles">
        <div className="lcp-section-title">
          Time-of-day comfort profiles
          <button type="button" className="lcp-info" onClick={() => setHelpKey("profiles")}>
            ?
          </button>
        </div>
        <p className="lcp-hint">
          Current period:{" "}
          <strong>
            {PERIOD_META[currentPeriod]?.label || currentPeriod || "—"} (
            {PERIOD_META[currentPeriod]?.hours || ""})
          </strong>
          . Saved 14 days; blended with forecast when Force is off.
        </p>
        {profiles && (
          <div className="lcp-prof-edit">
            <select
              value={editPeriod}
              onChange={(e) => {
                const p = e.target.value;
                setEditPeriod(p);
                if (profiles[p]) {
                  setRangeMin(profiles[p].feels_min);
                  setRangeMax(profiles[p].feels_max);
                }
              }}
            >
              {PERIOD_ORDER.map((k) => (
                <option key={k} value={k}>
                  {PERIOD_META[k].label} ({PERIOD_META[k].hours})
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => void saveProfile()}>
              Save current range to this period
            </button>
          </div>
        )}
      </div>

      {/* 24h plan by period rows */}
      {decision && decision.day_plan?.length > 0 && (
        <div className="lcp-day">
          <div className="lcp-section-title">
            24-hour outdoor + plan
            <button type="button" className="lcp-info" onClick={() => setHelpKey("plan")}>
              ?
            </button>
          </div>
          <p className="lcp-hint">
            Each cell: hour · outdoor °C · RH% · planned mode. Your comfort range is applied per
            period.
          </p>
          {PERIOD_ORDER.map((period) => {
            const cells = planByPeriod[period] || [];
            if (!cells.length) return null;
            const meta = PERIOD_META[period];
            return (
              <div key={period} className="lcp-period-row">
                <div
                  className="lcp-period-label"
                  style={{ background: meta.color, color: meta.text }}
                >
                  <strong>{meta.label}</strong>
                  <span>{meta.hours}</span>
                  {profiles?.[period] && (
                    <span className="lcp-period-band">
                      band {profiles[period].feels_min}–{profiles[period].feels_max}°
                    </span>
                  )}
                </div>
                <div className="lcp-period-cells">
                  {cells.map((d) => (
                    <div
                      key={d.hour}
                      className={`lcp-day-cell mode-${d.mode}`}
                      style={{ borderColor: meta.color }}
                      title={`${d.hour}:00 · outdoor ${d.t_out}°C / ${d.rh_out}% · pred feels ${d.pred_feels}° · mode ${d.mode}`}
                    >
                      <span className="hr">{d.hour}</span>
                      <span className="out">{d.t_out}°</span>
                      <span className="rh">{Math.round(d.rh_out)}%</span>
                      <span className="md">{d.mode}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {helpKey && FEATURE_HELP[helpKey] && (
        <div className="lcp-modal" onClick={() => setHelpKey(null)}>
          <div className="lcp-modal-body" onClick={(e) => e.stopPropagation()}>
            <h3>About this feature</h3>
            <p>{FEATURE_HELP[helpKey]}</p>
            <button type="button" className="btn" onClick={() => setHelpKey(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
