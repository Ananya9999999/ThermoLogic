import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import "./Layout.css";

export default function Layout() {
  return (
    <div className="layout">
      <Navbar />
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>© 2026 ThermoLogic · Smart HVAC for a cooler planet</span>
          <div className="footer-links">
            <a href="/about">About</a>
            <a href="/terms">Terms & Conditions</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
