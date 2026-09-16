import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Home } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

type AccountKind = "user" | "corporate";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial: AccountKind = params.get("type") === "corporate" ? "corporate" : "user";
  const [kind, setKind] = useState<AccountKind>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      localStorage.setItem("tl_account_kind", kind);
      navigate(kind === "corporate" ? "/app/corporate" : "/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth-page">
      <div className="card auth-card">
        <h1>Welcome back</h1>
        <p className="auth-sub">Choose how you use ThermoLogic, then sign in.</p>

        <div className="auth-kind">
          <button
            type="button"
            className={kind === "user" ? "on" : ""}
            onClick={() => setKind("user")}
          >
            <Home size={18} />
            <span>Home / personal</span>
            <small>Rooms, residential AC, comfort profiles</small>
          </button>
          <button
            type="button"
            className={kind === "corporate" ? "on" : ""}
            onClick={() => setKind("corporate")}
          >
            <Building2 size={18} />
            <span>Corporate</span>
            <small>Warehouses, cold storage, hotels, F&amp;B</small>
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in…" : kind === "corporate" ? "Sign in as corporate" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link to={`/signup?type=${kind}`}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
