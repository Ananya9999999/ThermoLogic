/**
 * Google Calendar read-only integration via GIS token client.
 * Set VITE_GOOGLE_CLIENT_ID in frontend/.env (OAuth Web client).
 */

export type CalEvent = {
  id: string;
  summary: string;
  start: string; // ISO or time label
  end: string;
  kind: "away" | "precool" | "occupied";
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.dataset.gis = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

function classify(summary: string): CalEvent["kind"] {
  const s = summary.toLowerCase();
  if (s.includes("away") || s.includes("office") || s.includes("work") || s.includes("travel"))
    return "away";
  if (s.includes("home") || s.includes("arrive") || s.includes("return")) return "occupied";
  return "occupied";
}

export function hasGoogleClientId(): boolean {
  return Boolean((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID);
}

export async function connectGoogleCalendar(): Promise<string> {
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error(
      "Add VITE_GOOGLE_CLIENT_ID to frontend/.env (Google Cloud OAuth Web client ID)."
    );
  }
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Google auth cancelled"));
          return;
        }
        sessionStorage.setItem("tl_google_token", resp.access_token);
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export async function fetchTodaysEvents(accessToken?: string): Promise<CalEvent[]> {
  const token = accessToken || sessionStorage.getItem("tl_google_token");
  if (!token) throw new Error("Not connected");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
    new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "15",
    });

  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Calendar API error: ${r.status} ${err.slice(0, 120)}`);
  }
  const j = await r.json();
  const items = j.items || [];
  return items.map((ev: any) => {
    const summary = ev.summary || "(No title)";
    const startRaw = ev.start?.dateTime || ev.start?.date || "";
    const endRaw = ev.end?.dateTime || ev.end?.date || "";
    const d = startRaw ? new Date(startRaw) : new Date();
    const timeLabel = Number.isNaN(d.getTime())
      ? "All day"
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
      id: ev.id,
      summary,
      start: timeLabel,
      end: endRaw,
      kind: classify(summary),
    } as CalEvent;
  });
}

/** Build UI schedule: Away blocks → eco; first post-away occupied → pre-cool ~35 min before */
export function buildPrecoolPlan(events: CalEvent[]): {
  time: string;
  label: string;
  kind: "away" | "precool" | "occupied";
  source: string;
}[] {
  const rows: { time: string; label: string; kind: "away" | "precool" | "occupied"; source: string }[] = [];
  for (const ev of events) {
    if (ev.kind === "away") {
      rows.push({
        time: ev.start,
        label: `Away — Eco Mode Active (${ev.summary})`,
        kind: "away",
        source: "Google Calendar",
      });
    } else {
      rows.push({
        time: ev.start,
        label: `Occupied — ${ev.summary}`,
        kind: "occupied",
        source: "Google Calendar",
      });
    }
  }
  // Insert a pre-cool hint before first evening occupied-like event
  const home = events.find((e) => e.kind === "occupied");
  if (home) {
    rows.unshift({
      time: "Pre-cool",
      label: `Pre-cooling ~35 min before “${home.summary}” based on outdoor heat index`,
      kind: "precool",
      source: "ThermoLogic planner",
    });
  }
  if (!rows.length) {
    rows.push({
      time: "—",
      label: "No events today — comfort mode",
      kind: "occupied",
      source: "Calendar",
    });
  }
  return rows;
}
