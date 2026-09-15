import { NavLink } from "react-router-dom";
import { Thermometer } from "lucide-react";
import "./Navbar.css";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/demo", label: "Live Demo" },
  { to: "/impact", label: "Impact" },
  { to: "/architecture", label: "Architecture" },
  { to: "/about", label: "About Us" },
];

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <NavLink to="/" className="brand">
          <Thermometer size={22} strokeWidth={2.2} />
          <span>ThermoLogic</span>
        </NavLink>
        <nav className="nav-links">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              end={l.to === "/"}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/terms" className="nav-link terms-link">
          Terms
        </NavLink>
      </div>
    </header>
  );
}
