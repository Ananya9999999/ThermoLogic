import { useMemo, useState } from "react";
import { calculateHeatIndex, comfortStatus, type ComfortStatus } from "./heatIndex";
import "./IndoorClimateCard.css";

interface Props {
  tempC?: number;
  humidity?: number;
  comfortMin?: number;
  comfortMax?: number;
  /** When true, show judge demo sliders */
  demoControls?: boolean;
}

function badgeClass(s: ComfortStatus): string {
  return s.toLowerCase().replace(/\s+/g, "-");
}

function gaugeColor(s: ComfortStatus): string {
  if (s === "Optimal") return "#10b981";
  if (s === "Cool") return "#06b6d4";
  if (s === "Slightly Humid" || s === "Warm") return "#f59e0b";
  return "#ef4444";
}

/** Map feels-like into 0–1 relative to comfort band */
function gaugeProgress(feels: number, min: number, max: number): number {
  const pad = 3;
  const lo = min - pad;
  const hi = max + pad;
  return Math.max(0, Math.min(1, (feels - lo) / (hi - lo)));
}

export default function IndoorClimateCard({
  tempC: tempProp = 26.5,
  humidity: humProp = 62,
  comfortMin = 24,
  comfortMax = 26.5,
  demoControls = true,
}: Props) {
  const [demo, setDemo] = useState(true);
  const [tempC, setTempC] = useState(tempProp);
  const [humidity, setHumidity] = useState(humProp);

  // Sync external when not in demo mode
  const t = tempC;
  const h = humidity;

  const feels = useMemo(() => calculateHeatIndex(t, h), [t, h]);
  const delta = feels - t;
  const status = comfortStatus(feels, h);
  const progress = gaugeProgress(feels, comfortMin, comfortMax);
  const color = gaugeColor(status);

  // Semi-circle path (viewBox 0 0 200 110)
  const r = 80;
  const cx = 100;
  const cy = 100;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle + (endAngle - startAngle) * progress;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(angle);
  const y2 = cy + r * Math.sin(angle);
  const large = progress > 0.5 ? 1 : 0;
  const arc =
    progress <= 0.001
      ? ""
      : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;

  return (
    <div className="icc" role="region" aria-label="Indoor climate">
      <div className="icc-header">
        <div className="icc-title">Indoor feels-like</div>
        <span className={`icc-badge ${badgeClass(status)}`}>{status}</span>
      </div>
      <div className="icc-feels">
        {feels.toFixed(1)}
        <span>°C</span>
      </div>
      <div className="icc-delta">
        {delta >= 0 ? "+" : ""}
        {delta.toFixed(1)}°C due to {Math.round(h)}% humidity
      </div>
      <div className="icc-pills">
        <div className="icc-pill">
          <div className="k">Raw temp</div>
          <div className="v">{t.toFixed(1)}°C</div>
        </div>
        <div className="icc-pill">
          <div className="k">Humidity</div>
          <div className="v">{Math.round(h)}%</div>
        </div>
        <div className="icc-pill">
          <div className="k">Band</div>
          <div className="v">
            {comfortMin}–{comfortMax}
          </div>
        </div>
      </div>
      <div className="icc-gauge-wrap" aria-hidden>
        <svg viewBox="0 0 200 115">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="rgba(107,76,50,0.12)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {arc && (
            <path
              d={arc}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
            />
          )}
          <text x="100" y="88" textAnchor="middle" fontSize="13" fill="#8b7355" fontWeight="600">
            Comfort zone
          </text>
        </svg>
        <div className="icc-gauge-label">
          Relative to {comfortMin}–{comfortMax}°C feels-like
        </div>
      </div>
      {demoControls && (
        <div className="icc-dev">
          <div className="icc-dev-title">Demo controls — drag to recalculate feels-like</div>
          <div className="icc-sliders">
            <label>
              Raw temperature: <strong>{tempC.toFixed(1)}°C</strong>
              <input
                type="range"
                min={18}
                max={40}
                step={0.1}
                value={tempC}
                onChange={(e) => {
                  setDemo(true);
                  setTempC(Number(e.target.value));
                }}
              />
            </label>
            <label>
              Humidity: <strong>{Math.round(humidity)}%</strong>
              <input
                type="range"
                min={20}
                max={95}
                step={1}
                value={humidity}
                onChange={(e) => {
                  setDemo(true);
                  setHumidity(Number(e.target.value));
                }}
              />
            </label>
            <p className="icc-dev-hint">
              Feels-like updates instantly via NWS Heat Index (Rothfusz). Try 30°C + 70% RH.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
