import { Outlet, Link } from "react-router-dom";
import Navbar from "./Navbar";
import FloatingShapes from "./FloatingShapes";
import { useAuth } from "../context/AuthContext";
import "./Layout.css";

export default function Layout() {
  const { user } = useAuth();
  return (
    <div className="layout">
      <FloatingShapes />
      <Navbar />
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <h3>ThermoLogic</h3>
            <p>Forecast-aware climate control for Indian homes — quieter bills, steadier comfort.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            {user ? (
              <>
                <Link to="/app">Dashboard</Link>
                <Link to="/app/control">Control Centre</Link>
                <Link to="/impact">Impact</Link>
              </>
            ) : (
              <Link to="/">Home</Link>
            )}
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            {user ? <Link to="/about">About Us</Link> : null}
            <Link to="/terms">Terms and Conditions</Link>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <p className="footer-note">Hackathon demo · 2026</p>
            <p className="footer-note">hello@thermologic.demo</p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 ThermoLogic</span>
          <span>Designed for comfort · Powered by foresight</span>
        </div>
      </footer>
    </div>
  );
}
