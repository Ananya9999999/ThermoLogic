import { useState } from "react";
import {
  buildPrecoolPlan,
  connectGoogleCalendar,
  fetchTodaysEvents,
  hasGoogleClientId,
} from "./googleCalendar";
import "./ScheduleOccupancyOptimizer.css";

type Row = { time: string; label: string; kind: "away" | "precool" | "occupied"; source?: string };

const DEMO: Row[] = [
  { time: "08:30", label: "Away (Eco Mode · 28°C)", kind: "away", source: "Demo" },
  { time: "17:25", label: "Pre-cool → 24°C by 17:30", kind: "precool", source: "Demo" },
  { time: "18:00", label: "Occupied (Comfort Mode)", kind: "occupied", source: "Demo" },
];

export default function ScheduleOccupancyOptimizer({ onWayHome }: { onWayHome?: () => void }) {
  const [rows, setRows] = useState<Row[]>(DEMO);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  async function linkCalendar() {
    setBusy(true);
    setStatus("");
    try {
      if (!hasGoogleClientId()) {
        setStatus(
          "Set VITE_GOOGLE_CLIENT_ID in frontend/.env (Google Cloud → OAuth 2.0 Web client). Using demo schedule until then."
        );
        setBusy(false);
        return;
      }
      const token = await connectGoogleCalendar();
      const events = await fetchTodaysEvents(token);
      setRows(buildPrecoolPlan(events));
      setLive(true);
      setStatus(`Loaded ${events.length} event(s) from Google Calendar.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Calendar connect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="soo soo-glass" role="region" aria-label="Schedule occupancy optimizer">
      <div className="soo-head">
        <div className="soo-title">Calendar · occupancy & pre-cool</div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button type="button" className="soo-btn secondary" onClick={linkCalendar} disabled={busy}>
            {busy ? "Connecting…" : live ? "Refresh Calendar" : "Connect Google Calendar"}
          </button>
          <button
            type="button"
            className="soo-btn"
            onClick={() => {
              setRows((r) => [
                {
                  time: "Now",
                  label: "Simulate Coming Home — pre-cool started (low power)",
                  kind: "precool",
                  source: "Manual",
                },
                ...r.filter((x) => x.kind !== "precool"),
              ]);
              onWayHome?.();
            }}
          >
            Simulate Coming Home Now
          </button>
        </div>
      </div>
      {status && <p className="soo-note" style={{ marginTop: 0 }}>{status}</p>}
      <div className="soo-timeline">
        {rows.map((e, i) => (
          <div className="soo-slot" key={`${e.time}-${i}`}>
            <div className="time">{e.time}</div>
            <div>
              <div className={`badge ${e.kind}`}>{e.label}</div>
              {e.source && (
                <div style={{ fontSize: "0.7rem", opacity: 0.7, marginTop: 2 }}>{e.source}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="soo-note">
        Pre-cooling starts from outdoor heat index and ~1.5°C / 20 min thermal inertia so the
        compressor ramps early at low power.
      </p>
    </div>
  );
}
