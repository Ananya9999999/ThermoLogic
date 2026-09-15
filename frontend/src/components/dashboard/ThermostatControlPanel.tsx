import { useMemo, useState } from "react";
import "./ThermostatControlPanel.css";

export type HvacMode = "auto" | "cool" | "dry" | "eco" | "off";
export type CompressorStatus = "Idle" | "Low Power" | "Active Cooling" | "Dehumidifying";

interface Props {
  initialSetpoint?: number;
  savingsKwh?: number;
  savingsInr?: number;
  /** Notify parent so graphs can re-run with new band */
  onBandChange?: (tMin: number, tMax: number, setpoint: number) => void;
}

const MODES: { id: HvacMode; label: string }[] = [
  { id: "auto", label: "Smart Adaptive" },
  { id: "cool", label: "Cool" },
  { id: "dry", label: "Dry" },
  { id: "eco", label: "Eco" },
  { id: "off", label: "Off" },
];

function statusFor(mode: HvacMode, setpoint: number): CompressorStatus {
  if (mode === "off") return "Idle";
  if (mode === "dry") return "Dehumidifying";
  if (mode === "eco") return "Low Power";
  if (mode === "auto") return setpoint <= 25 ? "Active Cooling" : "Low Power";
  return "Active Cooling";
}

function statusDot(s: CompressorStatus): string {
  if (s === "Idle") return "idle";
  if (s === "Low Power") return "low";
  if (s === "Dehumidifying") return "dry";
  return "active";
}

function mlSchedule(baseMin: number, baseMax: number): number[] {
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 13 && h <= 17) return baseMax - 0.3;
    if (h >= 6 && h <= 9) return baseMin + 0.5;
    if (h >= 22 || h <= 5) return baseMax;
    return (baseMin + baseMax) / 2;
  });
}

export default function ThermostatControlPanel({
  initialSetpoint = 25,
  savingsKwh = 4.2,
  savingsInr = 32,
  onBandChange,
}: Props) {
  const [setpoint, setSetpoint] = useState(initialSetpoint);
  const [mode, setMode] = useState<HvacMode>("auto");
  const [bandMin, setBandMin] = useState(23);
  const [bandMax, setBandMax] = useState(26.5);
  const [mlOn, setMlOn] = useState(true);

  const status = statusFor(mode, setpoint);
  const schedule = useMemo(() => mlSchedule(bandMin, bandMax), [bandMin, bandMax]);

  const minSp = 18;
  const maxSp = 30;
  const progress = Math.max(0, Math.min(1, (setpoint - minSp) / (maxSp - minSp)));

  // Full circle track with 270° active arc via stroke-dasharray
  const r = 70;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.75; // 270 degrees
  const trackLen = circumference * arcFraction;
  const progressLen = trackLen * progress;
  // Rotate so gap is at bottom
  const rotation = 135; // degrees

  function bump(delta: number) {
    const next = Math.max(minSp, Math.min(maxSp, +(setpoint + delta).toFixed(1)));
    setSetpoint(next);
    onBandChange?.(bandMin, bandMax, next);
  }

  function changeBand(minV: number, maxV: number) {
    setBandMin(minV);
    setBandMax(maxV);
    onBandChange?.(minV, maxV, setpoint);
  }

  return (
    <div className="tcp" role="region" aria-label="Thermostat control">
      <div className="tcp-title">Thermostat · Feels-like setpoint</div>
      <div className="tcp-dial-wrap">
        <div className="tcp-dial">
          <svg viewBox="0 0 180 180" width="180" height="180">
            <g transform={`rotate(${rotation} ${cx} ${cy})`}>
              {/* Track */}
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
              {/* Progress */}
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
              onBandChange?.(bandMin, bandMax, v);
            }}
            aria-label="Setpoint"
          />
          <button type="button" aria-label="Increase" onClick={() => bump(0.5)}>
            +
          </button>
        </div>
      </div>

      <div className="tcp-modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? "active" : ""}
            onClick={() => setMode(m.id)}
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
            min={18}
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
            min={20}
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
              ML auto-adjusting setpoints to optimize energy while keeping feels-like within your
              comfort band.
            </div>
            <div className="tcp-timeline" title="24-hour predicted setpoints">
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
          <div className="k">Est. saved</div>
          <div className="v">{savingsKwh.toFixed(1)} kWh</div>
        </div>
        <div className="box">
          <div className="k">vs 22°C reactive</div>
          <div className="v">₹{Math.round(savingsInr)}</div>
        </div>
      </div>
    </div>
  );
}
