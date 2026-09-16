import { NavLink, Link } from "react-router-dom";
import { Thermometer, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const isCorporate = typeof window !== "undefined" && localStorage.getItem("tl_account_kind") === "corporate";

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <Link to={user ? "/app" : "/"} className="brand">
          <span className="brand-icon">
            <Thermometer size={20} strokeWidth={2.2} />
          </span>
          <span className="brand-text">ThermoLogic</span>
        </Link>

        {user ? (
          <nav className="nav-links">
            <NavLink to="/app" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Dashboard
            </NavLink>
            {isCorporate && (
              <NavLink to="/app/profiles" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Profiles
              </NavLink>
            )}
            <NavLink to="/app/control" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Control Centre
            </NavLink>
            <NavLink to="/app/calculator" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Calculator
            </NavLink>
            {isCorporate && (
              <NavLink to="/app/corporate" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Corporate
              </NavLink>
            )}
            <NavLink to="/impact" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Impact
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              About Us
            </NavLink>
            <NavLink to="/terms" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Terms
            </NavLink>
          </nav>
        ) : (
          <nav className="nav-links">
            <a href="/#mission" className="nav-link">
              Mission
            </a>
            <a href="/#what-we-do" className="nav-link">
              What we do
            </a>
            <a href="/#about" className="nav-link">
              About
            </a>
            <NavLink to="/terms" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Terms
            </NavLink>
          </nav>
        )}

        <div className="nav-auth">
          {!loading && user ? (
            <>
              <span className="nav-user">{user.name.split(" ")[0]}</span>
              <button type="button" className="nav-logout" onClick={logout} title="Sign out">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Sign in
              </Link>
              <Link to="/signup" className="btn btn-primary nav-cta">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
