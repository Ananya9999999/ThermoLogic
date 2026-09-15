import { useEffect, useMemo, useState } from "react";
import { calculateHeatIndex } from "./heatIndex";
import "./ThermostatControlPanel.css";

export type HvacMode = "auto" | "cool" | "dry" | "eco" | "off";
export type CompressorStatus = "Idle" | "Low Power" | "Active Cooling" | "Dehumidifying";

interface Props {
  initialSetpoint?: number;
  /** Live ML predicted indoor dry-bulb (°C) */
  predictedTempC?: number | null;
  /** Live ML predicted indoor RH (%) */
  predictedHumidity?: number | null;
  /** From last predict summary */
  savingsKwh?: number | null;
  savingsInr?: number | null;
  busy?: boolean;
  onBandChange?: (tMin: number, tMax: number, setpoint: number, mode: HvacMode) => void;
}

const MODES: { id: HvacMode; label: string }[] = [
  { id: "auto", label: "Smart Adaptive" },
  { id: "cool", label: "Cool" },
  { id: "dry", label: "Dry" },
  { id: "eco", label: "Eco" },
  { id: "off", label: "Off" },
];

function statusFor(mode: HvacMode, setpoint: number, predictedFeels: number | null): CompressorStatus {
  if (mode === "off") return "Idle";
  if (mode === "dry") return "Dehumidifying";
  if (mode === "eco") return "Low Power";
  if (predictedFeels != null && predictedFeels > setpoint + 0.4) return "Active Cooling";
  if (mode === "auto") return setpoint <= 25 ? "Active Cooling" : "Low Power";
  return "Active Cooling";
}

function statusDot(s: CompressorStatus): string {
  if (s === "Idle") return "idle";
  if (s === "Low Power") return "low";
  if (s === "Dehumidifying") return "dry";
  return "active";
}

/** Hourly target feels-like from band + peak-afternoon bias when ML on */
function mlSchedule(baseMin: number, baseMax: number, center: number): number[] {
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 13 && h <= 17) return Math.max(baseMin, center - 0.6);
    if (h >= 6 && h <= 9) return Math.min(baseMax, center + 0.3);
    if (h >= 22 || h <= 5) return Math.min(baseMax, center + 0.8);
    return center;
  });
}

export default function ThermostatControlPanel({
  initialSetpoint = 25,
  predictedTempC = null,
  predictedHumidity = null,
  savingsKwh = null,
  savingsInr = null,
  busy = false,
  onBandChange,
}: Props) {
  const [setpoint, setSetpoint] = useState(initialSetpoint);
  const [mode, setMode] = useState<HvacMode>("auto");
  const [bandMin, setBandMin] = useState(initialSetpoint - 2);
  const [bandMax, setBandMax] = useState(initialSetpoint + 2);
  const [mlOn, setMlOn] = useState(true);

  // Keep band centered when setpoint moves a lot
  useEffect(() => {
    if (setpoint < bandMin || setpoint > bandMax) {
      const minV = +(setpoint - 2).toFixed(1);
      const maxV = +(setpoint + 2).toFixed(1);
      setBandMin(minV);
      setBandMax(maxV);
    }
  }, [setpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  const predictedFeels =
    predictedTempC != null && predictedHumidity != null
      ? calculateHeatIndex(predictedTempC, predictedHumidity)
      : null;

  const status = statusFor(mode, setpoint, predictedFeels);
  const schedule = useMemo(
    () => mlSchedule(bandMin, bandMax, setpoint),
    [bandMin, bandMax, setpoint]
  );

  const minSp = 18;
  const maxSp = 30;
  const progress = Math.max(0, Math.min(1, (setpoint - minSp) / (maxSp - minSp)));
  const r = 70;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.75;
  const trackLen = circumference * arcFraction;
  const progressLen = trackLen * progress;
  const rotation = 135;

  function emit(minV: number, maxV: number, sp: number, m: HvacMode = mode) {
    onBandChange?.(minV, maxV, sp, m);
  }

  function bump(delta: number) {
    const next = Math.max(minSp, Math.min(maxSp, +(setpoint + delta).toFixed(1)));
    setSetpoint(next);
    emit(bandMin, bandMax, next);
  }

  function changeBand(minV: number, maxV: number) {
    if (minV >= maxV) return;
    setBandMin(minV);
    setBandMax(maxV);
    emit(minV, maxV, setpoint);
  }

  function changeMode(m: HvacMode) {
    setMode(m);
    emit(bandMin, bandMax, setpoint, m);
  }

  return (
    <div className="tcp" role="region" aria-label="Thermostat control">
      <div className="tcp-title">Thermostat · Feels-like setpoint</div>
      {busy && <div className="tcp-pill">Updating ML forecast…</div>}

      <div className="tcp-dial-wrap">
        <div className="tcp-dial">
          <svg viewBox="0 0 180 180" width="180" height="180">
            <g transform={`rotate(${rotation} ${cx} ${cy})`}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(107,76,50,0.12)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${trackLen} ${circumference}`}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="var(--olive, #6b7c3e)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${progressLen} ${circumference}`}
                style={{ transition: "stroke-dasharray 0.25s ease" }}
              />
            </g>
          </svg>
          <div className="tcp-dial-center">
            <div className="sp">
              {setpoint.toFixed(1)}
              <span>°C</span>
            </div>
            <div className="lbl">target feels-like</div>
          </div>
        </div>
        <div className="tcp-slider-row">
          <button type="button" aria-label="Decrease" onClick={() => bump(-0.5)}>
            −
          </button>
          <input
            type="range"
            min={minSp}
            max={maxSp}
            step={0.5}
            value={setpoint}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSetpoint(v);
              emit(bandMin, bandMax, v);
            }}
            aria-label="Setpoint"
          />
          <button type="button" aria-label="Increase" onClick={() => bump(0.5)}>
            +
          </button>
        </div>
      </div>

      <div className="tcp-live">
        <div className="box">
          <div className="k">ML indoor feels-like</div>
          <div className="v">
            {predictedFeels != null ? `${predictedFeels.toFixed(1)}°C` : "—"}
          </div>
        </div>
        <div className="box">
          <div className="k">vs target</div>
          <div className="v">
            {predictedFeels != null
              ? `${predictedFeels - setpoint >= 0 ? "+" : ""}${(predictedFeels - setpoint).toFixed(1)}°C`
              : "—"}
          </div>
        </div>
      </div>

      <div className="tcp-modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? "active" : ""}
            onClick={() => changeMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="tcp-status">
        <span className={`dot ${statusDot(status)}`} />
        Compressor: <strong>{status}</strong>
      </div>

      <div className="tcp-range">
        <label>
          Comfort min (°C)
          <input
            type="number"
            min={16}
            max={28}
            step={0.5}
            value={bandMin}
            onChange={(e) => changeBand(Number(e.target.value), bandMax)}
          />
        </label>
        <label>
          Comfort max (°C)
          <input
            type="number"
            min={18}
            max={32}
            step={0.5}
            value={bandMax}
            onChange={(e) => changeBand(bandMin, Number(e.target.value))}
          />
        </label>
      </div>

      <div className="tcp-ml">
        <div className="tcp-ml-head">
          <label>
            <input type="checkbox" checked={mlOn} onChange={(e) => setMlOn(e.target.checked)} />
            AI Adaptive Schedule
          </label>
        </div>
        {mlOn && (
          <>
            <div className="tcp-pill">
              Hourly target feels-like from your setpoint and band (peak hours slightly cooler).
            </div>
            <div className="tcp-timeline" title="24-hour target setpoints">
              {schedule.map((v, h) => {
                const t = (v - bandMin) / Math.max(0.1, bandMax - bandMin);
                const g = Math.round(100 + t * 80);
                return (
                  <div
                    key={h}
                    style={{ background: `rgb(${g}, ${140 + t * 40}, ${90})` }}
                    title={`${h}:00 → ${v.toFixed(1)}°C`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="tcp-savings">
        <div className="box">
          <div className="k">Horizon energy</div>
          <div className="v">
            {savingsKwh != null ? `${Number(savingsKwh).toFixed(1)} kWh` : "—"}
          </div>
        </div>
        <div className="box">
          <div className="k">Horizon cost</div>
          <div className="v">
            {savingsInr != null ? `₹${Math.round(Number(savingsInr))}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
