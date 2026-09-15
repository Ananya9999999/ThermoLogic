import { useEffect, useMemo, useState } from "react";
import { calculateHeatIndex, comfortStatus, type ComfortStatus } from "./heatIndex";
import "./IndoorClimateCard.css";

interface Props {
  tempC?: number;
  humidity?: number;
  comfortMin?: number;
  comfortMax?: number;
  /** Judge-only sliders; off by default for live data */
  demoControls?: boolean;
}

function badgeClass(s: ComfortStatus): string {
  return s.toLowerCase().replace(/\s+/g, "-");
}

function gaugeColor(s: ComfortStatus): string {
  if (s === "Optimal") return "#6b7c3e";
  if (s === "Cool") return "#5a6d76";
  if (s === "Slightly Humid" || s === "Warm") return "#8f5b34";
  return "#a63d2f";
}

function gaugeProgress(feels: number, min: number, max: number): number {
  const pad = 3;
  const lo = min - pad;
  const hi = max + pad;
  return Math.max(0, Math.min(1, (feels - lo) / (hi - lo)));
}

export default function IndoorClimateCard({
  tempC: tempProp = 24,
  humidity: humProp = 55,
  comfortMin = 22,
  comfortMax = 26,
  demoControls = false,
}: Props) {
  const [tempC, setTempC] = useState(tempProp);
  const [humidity, setHumidity] = useState(humProp);

  useEffect(() => {
    setTempC(tempProp);
    setHumidity(humProp);
  }, [tempProp, humProp]);

  const feels = useMemo(() => calculateHeatIndex(tempC, humidity), [tempC, humidity]);
  const status = comfortStatus(feels, humidity);
  const progress = gaugeProgress(feels, comfortMin, comfortMax);
  const color = gaugeColor(status);

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
        <div className="icc-title">Room climate (ML)</div>
        <span className={`icc-badge ${badgeClass(status)}`}>{status}</span>
      </div>

      {/* Primary: room temperature, feels-like, humidity */}
      <div className="icc-pills">
        <div className="icc-pill">
          <div className="k">Room temp</div>
          <div className="v">{tempC.toFixed(1)}°C</div>
        </div>
        <div className="icc-pill">
          <div className="k">Feels like</div>
          <div className="v">{feels.toFixed(1)}°C</div>
        </div>
        <div className="icc-pill">
          <div className="k">Humidity</div>
          <div className="v">{humidity.toFixed(0)}%</div>
        </div>
      </div>

      <div className="icc-feels">
        {feels.toFixed(1)}
        <span>°C feels</span>
      </div>
      <div className="icc-delta">
        Dry-bulb {tempC.toFixed(1)}°C · RH {humidity.toFixed(0)}%
      </div>

      <svg className="icc-gauge" viewBox="0 0 200 110" aria-hidden>
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(107,76,50,0.12)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {arc && (
          <path d={arc} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        )}
      </svg>
      <div className="icc-band">
        Comfort band {comfortMin.toFixed(1)}–{comfortMax.toFixed(1)}°C
      </div>

      {demoControls && (
        <div className="icc-demo">
          <label>
            Temp {tempC.toFixed(1)}
            <input
              type="range"
              min={18}
              max={34}
              step={0.1}
              value={tempC}
              onChange={(e) => setTempC(+e.target.value)}
            />
          </label>
          <label>
            RH {humidity.toFixed(0)}
            <input
              type="range"
              min={30}
              max={80}
              step={1}
              value={humidity}
              onChange={(e) => setHumidity(+e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}