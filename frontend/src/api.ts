const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("tl_token");
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const msg = typeof detail === "string" ? detail : res.statusText || "Request failed";
    throw new Error(msg);
  }
  return res.json();
}

export type User = { id: number; email: string; name: string; created_at?: string };

export type Appliance = {
  id: number;
  user_id: number;
  name: string;
  kind: string;
  room: string;
  tonnage: number;
  iseer: number;
  star?: number;
  power_w?: number;
  catalog_id?: string | null;
  t_min: number;
  t_max: number;
  enabled: boolean;
  meta?: Record<string, unknown>;
};

export async function signup(email: string, name: string, password: string) {
  return handle<{ access_token: string; user: User }>(
    await fetch(`${API_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    })
  );
}

export async function login(email: string, password: string) {
  return handle<{ access_token: string; user: User }>(
    await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  );
}

export async function me() {
  return handle<User>(await fetch(`${API_URL}/api/auth/me`, { headers: authHeaders() }));
}

export async function listAppliances() {
  return handle<Appliance[]>(await fetch(`${API_URL}/api/appliances`, { headers: authHeaders() }));
}

export async function createAppliance(data: Partial<Appliance> & { name: string }) {
  return handle<Appliance>(
    await fetch(`${API_URL}/api/appliances`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    })
  );
}

export async function updateAppliance(id: number, data: Partial<Appliance>) {
  return handle<Appliance>(
    await fetch(`${API_URL}/api/appliances/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(data),
    })
  );
}

export async function deleteAppliance(id: number) {
  return handle<{ ok: boolean }>(
    await fetch(`${API_URL}/api/appliances/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    })
  );
}

export async function fetchDashboard(mode: string = "heatwave", hours: number = 48) {
  return handle<{
    user: User;
    appliances: Appliance[];
    aggregate: Record<string, number | string>;
    simulations: {
      appliance: { id: number; name: string; kind: string; room: string; tonnage: number };
      metrics: Record<string, number>;
      points: Record<string, number>[];
      t_min: number;
      t_max: number;
    }[];
  }>(
    await fetch(`${API_URL}/api/dashboard?mode=${mode}&hours=${hours}`, {
      headers: authHeaders(),
    })
  );
}

export async function runSimulate(params: Record<string, unknown>) {
  return handle<Record<string, unknown>>(
    await fetch(`${API_URL}/api/simulate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(params),
    })
  );
}

export type CalcParams = {
  tonnage: number;
  iseer: number;
  hours_per_day: number;
  days_per_year: number;
  tariff_inr_per_kwh: number;
  savings_pct: number;
  peak_share_pct: number;
  grid_ef_tco2_per_mwh: number;
};

export type CalcResult = {
  baseline_kwh_year: number;
  mpc_kwh_year: number;
  saved_kwh_year: number;
  baseline_cost_inr: number;
  mpc_cost_inr: number;
  saved_inr_year: number;
  co2_tons_year: number;
  assumptions: Record<string, unknown>;
};

export async function runCalculator(params: CalcParams) {
  return handle<CalcResult>(
    await fetch(`${API_URL}/api/calculator`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(params),
    })
  );
}

export async function fetchImpact() {
  return handle<Record<string, unknown>>(await fetch(`${API_URL}/api/impact`));
}

export { API_URL };

export type CatalogItem = {
  id: string;
  brand: string;
  model: string;
  kind: string;
  tonnage?: number;
  star: number;
  iseer?: number;
  power_w: number;
  annual_kwh_label?: number;
  annual_kwh?: number;
  capacity_l?: number;
  type?: string;
  notes?: string;
};

export async function fetchCatalog() {
  return handle<{ acs: CatalogItem[]; refrigerators: CatalogItem[]; research: Record<string, unknown>[] }>(
    await fetch(`${API_URL}/api/catalog`)
  );
}

export async function runPredict(body: Record<string, unknown>) {
  return handle<{
    weather_source: string;
    city: string;
    recommended_setpoint: { t_min: number; t_max: number; target: number; reason: string };
    research: { title: string; relevance: string; year: number }[];
    points: Record<string, number | boolean>[];
    summary: Record<string, number | string>;
  }>(
    await fetch(`${API_URL}/api/predict`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
  );
}

// ----- Live dynamic control & comfort profiles -----

export type LiveControlBody = {
  room_temp_c: number;
  room_humidity: number;
  outdoor_temp?: number | null;
  outdoor_humidity?: number | null;
  comfort_pref?: string;
  force_mode?: "auto" | "cool" | "dry" | "heat" | "idle" | "off" | null;
  force_setpoint?: number | null;
  force_feels_min?: number | null;
  force_feels_max?: number | null;
  hour?: number | null;
  include_forecast?: boolean;
  industrial?: boolean;
  lat?: number | null;
  lon?: number | null;
  city?: string | null;
};

export type LiveControlResult = {
  mode: string;
  power_fraction: number;
  target_dry_bulb_c: number;
  current_feels_c: number;
  feels_min: number;
  feels_max: number;
  room_humidity: number;
  reason: string;
  energy_hint: string;
  plan_next_6h: { hour_offset: number; mode: string; target_feels: number; power: number }[];
  period: string;
  day_plan: {
    hour: number;
    period: string;
    feels_min: number;
    feels_max: number;
    pred_feels: number;
    mode: string;
    power: number;
    t_out: number;
    rh_out: number;
  }[];
  decided_at: string;
};

export async function runLiveControl(body: LiveControlBody) {
  return handle<LiveControlResult>(
    await fetch(`${API_URL}/api/live-control`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
  );
}

export async function fetchHeatIndex(temp_c: number, humidity: number) {
  return handle<{ temp_c: number; humidity: number; feels_like_c: number }>(
    await fetch(`${API_URL}/api/heat-index`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ temp_c, humidity }),
    })
  );
}

export type ComfortProfiles = Record<
  string,
  { feels_min: number; feels_max: number; raw_temp: number; humidity: number }
>;

export async function fetchComfortProfiles() {
  return handle<{ profiles: ComfortProfiles; current_period: string; source: string }>(
    await fetch(`${API_URL}/api/comfort-profiles`, { headers: authHeaders() })
  );
}

export async function saveComfortProfiles(profiles: Partial<ComfortProfiles>) {
  return handle<{ profiles: ComfortProfiles; current_period: string; source: string }>(
    await fetch(`${API_URL}/api/comfort-profiles`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(profiles),
    })
  );
}
