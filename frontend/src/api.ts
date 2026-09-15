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
    throw new Error(body.detail || res.statusText || "Request failed");
  }
  return res.json();
}

export type User = { id: number; email: string; name: string; created_at?: string };

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
  return handle<User>(
    await fetch(`${API_URL}/api/auth/me`, { headers: authHeaders() })
  );
}

export async function fetchReference() {
  return handle<Record<string, unknown>>(
    await fetch(`${API_URL}/api/reference`)
  );
}

export async function fetchImpact() {
  return handle<Record<string, unknown>>(
    await fetch(`${API_URL}/api/impact`)
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

export type SimParams = {
  mode: "heatwave" | "smooth";
  away?: boolean;
  comfort_nudge?: number;
  hours?: number;
  t_min?: number;
  t_max?: number;
  r_thermal?: number;
  c_thermal?: number;
  u_cool_max?: number;
  price_offpeak?: number;
  price_peak?: number;
};

export async function runSimulate(params: SimParams) {
  return handle<Record<string, unknown>>(
    await fetch(`${API_URL}/api/simulate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(params),
    })
  );
}

export { API_URL };
