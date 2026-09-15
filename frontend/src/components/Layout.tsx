import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import FloatingShapes from "./FloatingShapes";
import "./Layout.css";

export default function Layout() {
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
            <p>
              Forecast-aware climate control for Indian homes — quieter bills,
              steadier comfort, less wasted cooling.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="/">Home</a>
            <a href="/demo">Live Demo</a>
            <a href="/calculator">Calculator</a>
            <a href="/impact">Impact</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="/about">About Us</a>
            <a href="/terms">Terms and Conditions</a>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <p className="footer-note">Hackathon demo · 2026</p>
            <p className="footer-note">hello@thermologic.demo</p>
            <p className="footer-note">Built for energy-aware living</p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 ThermoLogic. All rights reserved.</span>
          <span>Designed for comfort · Powered by foresight</span>
        </div>
      </footer>
    </div>
  );
}
