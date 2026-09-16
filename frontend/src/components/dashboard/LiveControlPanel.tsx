/**
 * Live dynamic control: room simulators, feels-like remote (min–max),
 * controller decision drives the remote unless Force is on,
 * 24h plan grouped by time-of-day with outdoor data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateHeatIndex, comfortStatus } from "./heatIndex";
import * as api from "../../api";
import type { LiveControlResult } from "../../api";
import { getActiveZone, controlLimitsForZone, RESIDENTIAL_LIMITS } from "../../lib/profileStore";
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
  tariff: "Shift load into cheap tariff windows: high % at night/off-peak, low % during expensive peak hours. The controller prefers running harder when electricity is cheap.",
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
  const isCorporate = typeof window !== "undefined" && localStorage.getItem("tl_account_kind") === "corporate";

  const [rawTemp, setRawTemp] = useState(() => {
    // Normal users: start at typical room temp; corporate may use zone midpoint (incl. freezers)
    if (!isCorporate) return 26.0;
    const z = getActiveZone();
    if (z) return (z.tMin + z.tMax) / 2;
    return 26.0;
  });
  const [humidity, setHumidity] = useState(58);

  // Remote range — residential 16–30 for normal users; zone profile only for corporate
  const [zoneLimits, setZoneLimits] = useState(() =>
    controlLimitsForZone(isCorporate ? getActiveZone() : null, { forceResidential: !isCorporate })
  );
  const [rangeMin, setRangeMin] = useState(() =>
    controlLimitsForZone(isCorporate ? getActiveZone() : null, { forceResidential: !isCorporate }).defaultMin
  );
  const [rangeMax, setRangeMax] = useState(() =>
    controlLimitsForZone(isCorporate ? getActiveZone() : null, { forceResidential: !isCorporate }).defaultMax
  );
  // Tariff: % of max cooling effort allowed per hour (cheap night = high, peak day = low)
  const [tariffPct, setTariffPct] = useState<number[]>(() => {
    const a = Array(24).fill(55);
    for (let h = 0; h < 24; h++) {
      if (h >= 22 || h < 6) a[h] = 95; // cheap overnight
      else if (h >= 10 && h <= 16) a[h] = 35; // expensive day peak
      else if (h >= 17 && h <= 21) a[h] = 50;
      else a[h] = 70;
    }
    return a;
  });
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
        force_feels_min: forceOn || (isCorporate && zoneLimits.industrial) ? rangeMin : undefined,
        force_feels_max: forceOn || (isCorporate && zoneLimits.industrial) ? rangeMax : undefined,
        include_forecast: !(isCorporate && zoneLimits.industrial),
        // Industrial (sub-zero / process) algorithm ONLY in corporate mode
        industrial: isCorporate && zoneLimits.industrial,
        city: city ?? undefined,
        hour: new Date().getHours(), // local browser hour (not UTC)
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
    isCorporate,
    zoneLimits.industrial,
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
    // Keep normal-user Control Centre on residential 16–30 °C only.
    // Corporate industrial bands stay isolated to corporate mode + zone profiles.
    const lim = controlLimitsForZone(
      isCorporate ? getActiveZone() : null,
      { forceResidential: !isCorporate }
    );
    setZoneLimits(lim);
    setRangeMin(lim.defaultMin);
    setRangeMax(lim.defaultMax);
    if (!isCorporate) {
      // Ensure raw temp slider stays in residential band
      setRawTemp((t) => Math.min(30, Math.max(16, t)));
    }
  }, [isCorporate]);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.fetchComfortProfiles();
        setProfiles(p.profiles);
        const localP = (() => {
          const h = new Date().getHours();
          if (h >= 4 && h < 7) return "early_morning";
          if (h >= 7 && h < 11) return "morning";
          if (h >= 11 && h < 15) return "noon";
          if (h >= 15 && h < 20) return "evening";
          return "night";
        })();
        setCurrentPeriod(localP);
        setEditPeriod(localP);
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
    const row = profiles[editPeriod] || {
      feels_min: rangeMin,
      feels_max: rangeMax,
      raw_temp: 24,
      humidity: 50,
    };
    try {
      const res = await api.saveComfortProfiles({
        [editPeriod]: {
          feels_min: row.feels_min,
          feels_max: row.feels_max,
          raw_temp: row.raw_temp ?? 24,
          humidity: row.humidity ?? 50,
        },
      });
      setProfiles(res.profiles);
      // Keep period from local clock so IST is correct even if server TZ differs
      setCurrentPeriod(localPeriodNow());
      void run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed — are you signed in?");
    }
  }

  function localPeriodNow(): string {
    const h = new Date().getHours();
    if (h >= 4 && h < 7) return "early_morning";
    if (h >= 7 && h < 11) return "morning";
    if (h >= 11 && h < 15) return "noon";
    if (h >= 15 && h < 20) return "evening";
    return "night";
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
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        // Night: 20–23 then 0–3
        if (key === "night") {
          const ah = a.hour < 12 ? a.hour + 24 : a.hour;
          const bh = b.hour < 12 ? b.hour + 24 : b.hour;
          return ah - bh;
        }
        return a.hour - b.hour;
      });
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

  const dialLo = zoneLimits.industrial ? zoneLimits.sliderMin : 16;
  const dialHi = zoneLimits.industrial ? zoneLimits.sliderMax : 30;
  const arcPct = Math.max(0, Math.min(1, (dialValue - dialLo) / Math.max(1, dialHi - dialLo)));
  const stroke = dialColor(dialValue);

  return (
    <div className="lcp card">
      <div className="lcp-head">
        <h2>{isCorporate && zoneLimits.industrial ? "Live process control" : "Live room control"}</h2>
        <p>
          {isCorporate && zoneLimits.industrial
            ? "Band comes from your saved zone profile. Controller holds process temperature inside min–max. Force locks operator overrides."
            : "Change room conditions or the comfort range — the controller re-decides immediately. With Force off, the remote follows the controller."}
        </p>
      </div>

      <div className="lcp-top">
        {/* Room simulation */}
        <div className="lcp-sim">
          <div className="lcp-section-title">
            {isCorporate && zoneLimits.industrial ? "Process state (demo)" : "Room state (demo)"}
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
              min={zoneLimits.sliderMin}
              max={zoneLimits.sliderMax}
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
              <span className="k">{isCorporate && zoneLimits.industrial ? "Process temp" : "Feels-like now"}</span>
              <span className="v">
                {isCorporate && zoneLimits.industrial ? rawTemp.toFixed(1) : feelsLocal.toFixed(1)}°C
              </span>
            </div>
            {!(isCorporate && zoneLimits.industrial) && (
              <div className={`lcp-status s-${status.replace(/\s/g, "").toLowerCase()}`}>{status}</div>
            )}
          </div>
        </div>

        {/* Remote */}
        <div className="lcp-remote">
          <div className="lcp-section-title">
            Thermostat · {zoneLimits.industrial ? "process band" : "feels-like range"}
            {zoneLimits.label && zoneLimits.industrial ? ` · ${zoneLimits.label}` : ""}
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
              {isCorporate && zoneLimits.industrial ? "Band min °C" : "Feels min"}
              <input
                type="number"
                step={0.5}
                min={zoneLimits.sliderMin}
                max={zoneLimits.sliderMax}
                value={forceOn || !decision ? rangeMin : decision.feels_min}
                onChange={(e) => {
                  const v = +e.target.value;
                  setForceOn(true);
                  setRangeMin(v);
                  if (v >= rangeMax) setRangeMax(v + 0.5);
                }}
              />
            </label>
            <label>
              {isCorporate && zoneLimits.industrial ? "Band max °C" : "Feels max"}
              <input
                type="number"
                step={0.5}
                min={zoneLimits.sliderMin}
                max={zoneLimits.sliderMax}
                value={forceOn || !decision ? rangeMax : decision.feels_max}
                onChange={(e) => {
                  const v = +e.target.value;
                  setForceOn(true);
                  setRangeMax(v);
                  if (v <= rangeMin) setRangeMin(v - 0.5);
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
            {isCorporate && zoneLimits.industrial ? "process" : "feels-like"}
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
                  <span className="k">{isCorporate && zoneLimits.industrial ? "Process temp" : "Room feels"}</span>
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
          Tariff-aware energy schedule
          <button type="button" className="lcp-info" onClick={() => setHelpKey("tariff")}>
            ?
          </button>
        </div>
        <p className="lcp-hint">
          Cheap electricity hours → allow higher compressor effort (%). Expensive peak hours → lower
          % so the system pre-cools / loads in off-peak and stays light on peak. Drag each hour.
        </p>
        <div className="lcp-tariff">
          {tariffPct.map((pct, h) => (
            <div key={h} className="lcp-tariff-cell" title={`${h}:00 → ${pct}% effort`}>
              <span className="h">{h}</span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={pct}
                orient="vertical"
                onChange={(e) => {
                  const next = [...tariffPct];
                  next[h] = +e.target.value;
                  setTariffPct(next);
                }}
              />
              <span className="p">{pct}%</span>
            </div>
          ))}
        </div>
        <p className="lcp-hint">
          Now ({new Date().getHours()}:00): allow{" "}
          <strong>{tariffPct[new Date().getHours()]}%</strong> of max effort · Night defaults high,
          midday peak low — adjust for your DISCOM tariff.
        </p>
      </div>

      {/* 24h plan by period rows */}
      {!(isCorporate && zoneLimits.industrial) && decision && decision.day_plan?.length > 0 && (
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
