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
