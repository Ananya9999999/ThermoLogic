/**
 * Corporate onboarding: multi-select work-types → zone templates with
 * industrial parameter sets (bands, hard limits, humidity, cycles, compliance).
 */
import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Plus, Trash2, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { upsertSite, setActiveSiteId, setActiveZoneId, type SiteProfile, type ZoneProfile } from "../lib/profileStore";
import "./CorporateDashboard.css";

type WorkType =
  | "warehouse_ambient"
  | "cold_chilled"
  | "cold_frozen"
  | "cold_deep"
  | "pharma_refrigerated"
  | "pharma_frozen"
  | "pharma_ult"
  | "pharma_transport"
  | "restaurant_walkin"
  | "hotel_guest"
  | "hotel_wine"
  | "greenhouse"
  | "custom";

type Zone = {
  id: string;
  name: string;
  workTypes: WorkType[];
  tMin: number;
  tMax: number;
  hardMin: number;
  hardMax: number;
  rhMin: number;
  rhMax: number;
  freezeProhibited: boolean;
  subZero: boolean;
  heating: boolean;
  scheduledCycles: string;
  doorFrequency: string;
  backupPower: boolean;
  compliance: string;
  alertTier: string;
  priority: "precision" | "energy" | "balanced";
  notes: string;
};

const WORK_TAGS: { id: WorkType; label: string; group: string }[] = [
  { id: "warehouse_ambient", label: "Warehouse (dry / ambient)", group: "Storage" },
  { id: "cold_chilled", label: "Cold storage — chilled 0–5°C", group: "Storage" },
  { id: "cold_frozen", label: "Cold storage — frozen ≤−18°C", group: "Storage" },
  { id: "cold_deep", label: "Deep-frozen ≤−30°C", group: "Storage" },
  { id: "pharma_refrigerated", label: "Pharma / vaccine +2–8°C", group: "Pharma" },
  { id: "pharma_frozen", label: "Pharma frozen −15–−25°C", group: "Pharma" },
  { id: "pharma_ult", label: "ULT −60–−80°C", group: "Pharma" },
  { id: "pharma_transport", label: "Medicine transport / reefer", group: "Pharma" },
  { id: "restaurant_walkin", label: "Restaurant walk-in / kitchen", group: "Hospitality" },
  { id: "hotel_guest", label: "Hotel guest rooms", group: "Hospitality" },
  { id: "hotel_wine", label: "Wine cellar", group: "Hospitality" },
  { id: "greenhouse", label: "Greenhouse / plant room", group: "Other" },
  { id: "custom", label: "Custom / industrial process", group: "Other" },
];

const DEFAULTS: Record<WorkType, Partial<Zone>> = {
  warehouse_ambient: { tMin: 10, tMax: 25, hardMin: 5, hardMax: 30, rhMin: 30, rhMax: 70, freezeProhibited: false, priority: "energy" },
  cold_chilled: { tMin: 0, tMax: 5, hardMin: -1, hardMax: 8, rhMin: 90, rhMax: 95, freezeProhibited: true, subZero: false, priority: "precision" },
  cold_frozen: { tMin: -22, tMax: -18, hardMin: -25, hardMax: -15, rhMin: 0, rhMax: 100, freezeProhibited: false, subZero: true, priority: "precision" },
  cold_deep: { tMin: -35, tMax: -30, hardMin: -40, hardMax: -25, subZero: true, priority: "precision" },
  pharma_refrigerated: {
    tMin: 2, tMax: 8, hardMin: 0, hardMax: 10, rhMin: 35, rhMax: 75,
    freezeProhibited: true, compliance: "WHO-GDP", priority: "precision",
    scheduledCycles: "None — continuous hold",
  },
  pharma_frozen: { tMin: -25, tMax: -15, hardMin: -30, hardMax: -12, freezeProhibited: false, subZero: true, compliance: "WHO-GDP", priority: "precision" },
  pharma_ult: { tMin: -80, tMax: -60, hardMin: -90, hardMax: -55, subZero: true, compliance: "USP<1079>", priority: "precision" },
  pharma_transport: {
    tMin: 2, tMax: 8, hardMin: 0, hardMax: 10, freezeProhibited: true, compliance: "WHO-GDP", priority: "precision",
    notes: "Transport: continuous logging + GPS correlation + quarantine on excursion",
  },
  restaurant_walkin: { tMin: 1, tMax: 4, hardMin: 0, hardMax: 5, freezeProhibited: true, compliance: "FDA Food Code", doorFrequency: "High (service)", priority: "balanced" },
  hotel_guest: { tMin: 22, tMax: 26, hardMin: 18, hardMax: 30, rhMin: 40, rhMax: 60, priority: "energy" },
  hotel_wine: { tMin: 12, tMax: 14, hardMin: 10, hardMax: 16, rhMin: 50, rhMax: 70, freezeProhibited: true, priority: "precision" },
  greenhouse: { tMin: 20, tMax: 25, hardMin: 10, hardMax: 30, rhMin: 35, rhMax: 80, heating: true, notes: "Day 20–25 / night 10–18 dual band recommended", priority: "balanced" },
  custom: { tMin: 18, tMax: 26, hardMin: 10, hardMax: 35, priority: "balanced" },
};

function blankZone(name: string, tags: WorkType[]): Zone {
  const primary = tags[0] || "custom";
  const d = DEFAULTS[primary] || {};
  return {
    id: crypto.randomUUID(),
    name,
    workTypes: tags,
    tMin: d.tMin ?? 18,
    tMax: d.tMax ?? 26,
    hardMin: d.hardMin ?? 10,
    hardMax: d.hardMax ?? 32,
    rhMin: d.rhMin ?? 30,
    rhMax: d.rhMax ?? 70,
    freezeProhibited: d.freezeProhibited ?? false,
    subZero: d.subZero ?? false,
    heating: d.heating ?? false,
    scheduledCycles: d.scheduledCycles ?? "None",
    doorFrequency: d.doorFrequency ?? "Low",
    backupPower: false,
    compliance: d.compliance ?? "none",
    alertTier: "Email 15 min → SMS 30 min",
    priority: d.priority ?? "balanced",
    notes: d.notes ?? "",
  };
}

export default function CorporateDashboard() {
  const { user } = useAuth();
  const kind = localStorage.getItem("tl_account_kind");
  const [siteName, setSiteName] = useState("Main site");
  const [selectedTags, setSelectedTags] = useState<WorkType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [saved, setSaved] = useState(false);

  if (kind !== "corporate") {
    return <Navigate to="/app" replace />;
  }

  function toggleTag(id: WorkType) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addZoneFromTags() {
    if (!selectedTags.length) return;
    const label = selectedTags
      .map((t) => WORK_TAGS.find((w) => w.id === t)?.label || t)
      .join(" + ");
    const z = blankZone(`Zone — ${label.slice(0, 40)}`, selectedTags);
    setZones((zs) => [...zs, z]);
    setEditing(z);
    setSaved(false);
  }

  function updateEditing<K extends keyof Zone>(key: K, value: Zone[K]) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  function commitZone() {
    if (!editing) return;
    setZones((zs) => zs.map((z) => (z.id === editing.id ? editing : z)));
    setEditing(null);
    setSaved(false);
  }

  function removeZone(id: string) {
    setZones((zs) => zs.filter((z) => z.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  function onSaveAll(e: FormEvent) {
    e.preventDefault();
    if (!zones.length) return;
    const site: SiteProfile = {
      id: crypto.randomUUID(),
      siteName: siteName.trim() || "Untitled site",
      kind: "corporate",
      workTags: selectedTags,
      zones: zones as unknown as ZoneProfile[],
      updatedAt: new Date().toISOString(),
    };
    upsertSite(site);
    setActiveSiteId(site.id);
    if (site.zones[0]) setActiveZoneId(site.zones[0].id);
    // clear form so next ownership is a new site
    setSiteName("New site");
    setSelectedTags([]);
    setZones([]);
    setEditing(null);
    setSaved(true);
  }

  const groups = useMemo(() => {
    const g: Record<string, typeof WORK_TAGS> = {};
    for (const t of WORK_TAGS) {
      (g[t.group] ||= []).push(t);
    }
    return g;
  }, []);

  return (
    <div className="container corp-dash">
      <header className="page-header">
        <span className="badge badge-warm">Corporate only</span>
        <h1>Industrial / commercial onboarding</h1>
        <p>
          Accounts are containers of <strong>zones</strong> (rooms, freezers, vehicles). Multi-select
          work types, then instantiate zones with researched defaults — editable bands, hard limits,
          humidity, cycles, and compliance.
        </p>
      </header>

      <section className="card corp-block">
        <h2>1. Site</h2>
        <label className="corp-field">
          Site name
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        </label>
      </section>

      <section className="card corp-block">
        <h2>2. Work-type tags (multi-select)</h2>
        <p className="corp-note">
          A hotel may need guest rooms + walk-in + wine cellar under one account. Select all that apply,
          then create a zone for each physical unit.
        </p>
        {Object.entries(groups).map(([group, tags]) => (
          <div key={group} className="corp-tag-group">
            <h3>{group}</h3>
            <div className="corp-tags">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={selectedTags.includes(t.id) ? "on" : ""}
                  onClick={() => toggleTag(t.id)}
                >
                  {selectedTags.includes(t.id) && <Check size={14} />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!selectedTags.length}
          onClick={addZoneFromTags}
        >
          <Plus size={16} /> Create zone from selected tags
        </button>
      </section>

      <section className="card corp-block">
        <h2>3. Zones ({zones.length})</h2>
        {!zones.length && (
          <p className="corp-note">No zones yet — select tags above and create a zone.</p>
        )}
        <ul className="corp-zone-list">
          {zones.map((z) => (
            <li key={z.id}>
              <button type="button" className="corp-zone-link" onClick={() => setEditing(z)}>
                <strong>{z.name}</strong>
                <span>
                  {z.tMin}–{z.tMax}°C · hard {z.hardMin}–{z.hardMax}°C · {z.compliance}
                </span>
              </button>
              <button type="button" className="corp-icon-btn" onClick={() => removeZone(z.id)} title="Remove">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {editing && (
        <section className="card corp-block corp-zone-form">
          <h2>Edit zone</h2>
          <p className="corp-note">
            Target band vs hard limits, humidity, freeze-prohibited, scheduled cycles (defrost etc.)
            so excursions are not false alarms.
          </p>
          <label className="corp-field">
            Zone name
            <input value={editing.name} onChange={(e) => updateEditing("name", e.target.value)} />
          </label>
          <div className="corp-grid-2">
            <label className="corp-field">
              Target min °C
              <input type="number" step={0.5} value={editing.tMin} onChange={(e) => updateEditing("tMin", +e.target.value)} />
            </label>
            <label className="corp-field">
              Target max °C
              <input type="number" step={0.5} value={editing.tMax} onChange={(e) => updateEditing("tMax", +e.target.value)} />
            </label>
            <label className="corp-field">
              Hard limit min °C
              <input type="number" step={0.5} value={editing.hardMin} onChange={(e) => updateEditing("hardMin", +e.target.value)} />
            </label>
            <label className="corp-field">
              Hard limit max °C
              <input type="number" step={0.5} value={editing.hardMax} onChange={(e) => updateEditing("hardMax", +e.target.value)} />
            </label>
            <label className="corp-field">
              RH min %
              <input type="number" value={editing.rhMin} onChange={(e) => updateEditing("rhMin", +e.target.value)} />
            </label>
            <label className="corp-field">
              RH max %
              <input type="number" value={editing.rhMax} onChange={(e) => updateEditing("rhMax", +e.target.value)} />
            </label>
          </div>
          <div className="corp-checks">
            <label>
              <input type="checkbox" checked={editing.freezeProhibited} onChange={(e) => updateEditing("freezeProhibited", e.target.checked)} />
              Freeze-prohibited goods
            </label>
            <label>
              <input type="checkbox" checked={editing.subZero} onChange={(e) => updateEditing("subZero", e.target.checked)} />
              Sub-zero equipment
            </label>
            <label>
              <input type="checkbox" checked={editing.heating} onChange={(e) => updateEditing("heating", e.target.checked)} />
              Heating equipment
            </label>
            <label>
              <input type="checkbox" checked={editing.backupPower} onChange={(e) => updateEditing("backupPower", e.target.checked)} />
              Backup power available
            </label>
          </div>
          <label className="corp-field">
            Scheduled cycles (defrost / blast / setback)
            <input value={editing.scheduledCycles} onChange={(e) => updateEditing("scheduledCycles", e.target.value)} placeholder="e.g. Defrost 03:00, 15 min, +8°C expected" />
          </label>
          <label className="corp-field">
            Door / access frequency
            <select value={editing.doorFrequency} onChange={(e) => updateEditing("doorFrequency", e.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High (service)</option>
              <option>Continuous (loading bay)</option>
            </select>
          </label>
          <label className="corp-field">
            Compliance framework
            <select value={editing.compliance} onChange={(e) => updateEditing("compliance", e.target.value)}>
              <option value="none">None</option>
              <option value="FDA Food Code">FDA Food Code</option>
              <option value="WHO-GDP">WHO-GDP</option>
              <option value="USP<1079>">USP&lt;1079&gt;</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="corp-field">
            Alert routing / escalation
            <input value={editing.alertTier} onChange={(e) => updateEditing("alertTier", e.target.value)} />
          </label>
          <label className="corp-field">
            Priority
            <select value={editing.priority} onChange={(e) => updateEditing("priority", e.target.value as Zone["priority"])}>
              <option value="precision">Precision-first (never trade for energy)</option>
              <option value="energy">Energy-first</option>
              <option value="balanced">Balanced</option>
            </select>
          </label>
          <label className="corp-field">
            Notes
            <input value={editing.notes} onChange={(e) => updateEditing("notes", e.target.value)} />
          </label>
          <div className="corp-actions">
            <button type="button" className="btn btn-primary" onClick={commitZone}>
              Apply zone changes
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <form onSubmit={onSaveAll} className="corp-save-bar">
        <button type="submit" className="btn btn-primary" disabled={!zones.length}>
          Save corporate profile
        </button>
        <Link to="/app/control" className="btn btn-outline">
          Control centre
        </Link>
        {saved && <span className="corp-saved">Site saved. Add another site below or open Profiles.</span>}
      </form>
    </div>
  );
}
