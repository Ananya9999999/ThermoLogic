import { Link, useNavigate } from "react-router-dom";
import { Building2, Home, Trash2, Thermometer, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  loadSites,
  deleteSite,
  setActiveSiteId,
  setActiveZoneId,
  type SiteProfile,
} from "../lib/profileStore";
import { useState } from "react";
import "./Profiles.css";

export default function Profiles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCorporate = localStorage.getItem("tl_account_kind") === "corporate";
  const [sites, setSites] = useState<SiteProfile[]>(() => loadSites());

  function openControl(site: SiteProfile, zoneId?: string) {
    setActiveSiteId(site.id);
    if (zoneId) setActiveZoneId(zoneId);
    else if (site.zones[0]) setActiveZoneId(site.zones[0].id);
    navigate("/app/control");
  }

  function remove(id: string) {
    if (!confirm("Delete this profile/site?")) return;
    setSites(deleteSite(id));
  }

  const filtered = sites.filter((s) =>
    isCorporate ? s.kind === "corporate" : s.kind === "home" || !s.kind
  );

  return (
    <div className="container profiles-page">
      <header className="page-header">
        <span className="badge badge-sage">Profiles</span>
        <h1>Your sites & zones</h1>
        <p>
          {user?.name ? `${user.name} · ` : ""}
          {isCorporate
            ? "Corporate accounts can own multiple sites (cold store, warehouse, …). Each zone has its own Control Centre limits."
            : "Home account — one comfort profile. Corporate multi-site lives under a corporate login."}
        </p>
      </header>

      {!filtered.length && (
        <div className="card profiles-empty">
          <p>No saved profiles yet.</p>
          {isCorporate ? (
            <Link to="/app/corporate" className="btn btn-primary">
              Create site on Corporate onboarding
            </Link>
          ) : (
            <p className="hint">Use Control Centre — a home profile is applied automatically.</p>
          )}
        </div>
      )}

      <div className="profiles-list">
        {filtered.map((site) => (
          <article key={site.id} className="card profile-card">
            <div className="profile-head">
              {site.kind === "corporate" ? <Building2 size={20} /> : <Home size={20} />}
              <div>
                <h2>{site.siteName}</h2>
                <span className="meta">
                  {site.kind} · {site.zones.length} zone(s) · updated{" "}
                  {new Date(site.updatedAt).toLocaleString()}
                </span>
              </div>
              <button type="button" className="icon-del" onClick={() => remove(site.id)} title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
            <ul className="zone-rows">
              {site.zones.map((z) => (
                <li key={z.id}>
                  <div>
                    <strong>{z.name}</strong>
                    <span>
                      {z.tMin}–{z.tMax}°C · hard {z.hardMin}–{z.hardMax}°C
                      {z.workTypes?.length ? ` · ${z.workTypes.join(", ")}` : ""}
                    </span>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openControl(site, z.id)}>
                    <Thermometer size={14} /> Control <ChevronRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
            {!site.zones.length && (
              <button type="button" className="btn btn-primary" onClick={() => openControl(site)}>
                Open Control Centre
              </button>
            )}
          </article>
        ))}
      </div>

      {isCorporate && (
        <Link to="/app/corporate" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Add another site
        </Link>
      )}
    </div>
  );
}
