import { NavLink, Link } from "react-router-dom";
import { Thermometer, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const links = [
  { to: "/", label: "Home" },
  { to: "/demo", label: "Live Demo" },
  { to: "/calculator", label: "Calculator" },
  { to: "/impact", label: "Impact" },
  { to: "/about", label: "About Us" },
  { to: "/terms", label: "Terms and Conditions" },
];

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <NavLink to="/" className="brand">
          <span className="brand-icon">
            <Thermometer size={20} strokeWidth={2.2} />
          </span>
          <span className="brand-text">ThermoLogic</span>
        </NavLink>
        <nav className="nav-links">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
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
              <Link to="/login" className="nav-link">Sign in</Link>
              <Link to="/signup" className="btn btn-primary nav-cta">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
