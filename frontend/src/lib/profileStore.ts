/** Multi-site / multi-zone profiles in localStorage (demo persistence). */

export type WorkType =
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
  | "custom"
  | "home";

export type ZoneProfile = {
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

export type SiteProfile = {
  id: string;
  siteName: string;
  kind: "home" | "corporate";
  workTags: WorkType[];
  zones: ZoneProfile[];
  updatedAt: string;
};

const SITES_KEY = "tl_sites";
const ACTIVE_KEY = "tl_active_site_id";
const ACTIVE_ZONE_KEY = "tl_active_zone_id";

export function loadSites(): SiteProfile[] {
  try {
    const raw = localStorage.getItem(SITES_KEY);
    if (raw) return JSON.parse(raw) as SiteProfile[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveSites(sites: SiteProfile[]) {
  localStorage.setItem(SITES_KEY, JSON.stringify(sites));
}

export function upsertSite(site: SiteProfile) {
  const sites = loadSites();
  const i = sites.findIndex((s) => s.id === site.id);
  if (i >= 0) sites[i] = site;
  else sites.push(site);
  saveSites(sites);
  return sites;
}

export function deleteSite(id: string) {
  const sites = loadSites().filter((s) => s.id !== id);
  saveSites(sites);
  if (getActiveSiteId() === id) {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(ACTIVE_ZONE_KEY);
  }
  return sites;
}

export function getActiveSiteId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveSiteId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveZoneId(): string | null {
  return localStorage.getItem(ACTIVE_ZONE_KEY);
}

export function setActiveZoneId(id: string) {
  localStorage.setItem(ACTIVE_ZONE_KEY, id);
}

export function getActiveSite(): SiteProfile | null {
  const id = getActiveSiteId();
  if (!id) return null;
  return loadSites().find((s) => s.id === id) || null;
}

export function getActiveZone(): ZoneProfile | null {
  const site = getActiveSite();
  if (!site?.zones?.length) return null;
  const zid = getActiveZoneId();
  return site.zones.find((z) => z.id === zid) || site.zones[0] || null;
}

/** Residential comfort limits — always used for normal (home) account mode. */
export const RESIDENTIAL_LIMITS = {
  sliderMin: 16,
  sliderMax: 30,
  defaultMin: 22,
  defaultMax: 26,
  label: "Room comfort",
  industrial: false as const,
};

/** Control limits derived from work type / zone.
 *  Pass forceResidential=true (or omit zone for home users) so industrial
 *  freezer bands never leak into the normal-user Control Centre.
 */
export function controlLimitsForZone(
  zone: ZoneProfile | null,
  opts?: { forceResidential?: boolean }
): {
  sliderMin: number;
  sliderMax: number;
  defaultMin: number;
  defaultMax: number;
  label: string;
  industrial: boolean;
} {
  // Normal user mode: never use corporate/industrial ranges
  if (opts?.forceResidential) {
    return { ...RESIDENTIAL_LIMITS };
  }

  if (!zone) {
    return { ...RESIDENTIAL_LIMITS, sliderMax: 30 };
  }
  const primary = zone.workTypes[0] || "custom";
  const industrial = ![
    "hotel_guest",
    "home",
    "custom",
  ].includes(primary) || zone.subZero || zone.tMin < 10;

  // Slider span: pad around hard limits so user can still nudge
  const pad = industrial ? 5 : 2;
  return {
    sliderMin: Math.min(zone.hardMin, zone.tMin) - pad,
    sliderMax: Math.max(zone.hardMax, zone.tMax) + pad,
    defaultMin: zone.tMin,
    defaultMax: zone.tMax,
    label: zone.name,
    industrial,
  };
}
