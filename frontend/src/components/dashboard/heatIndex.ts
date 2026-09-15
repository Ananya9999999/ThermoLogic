/**
 * Official NWS Heat Index (Rothfusz) with Steadman simple branch.
 * https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 */
export function calculateHeatIndex(tempC: number, humidity: number): number {
  if (humidity == null || Number.isNaN(humidity) || Number.isNaN(tempC)) return tempC;
  const rh = Math.max(0, Math.min(100, humidity));
  const T = (tempC * 9) / 5 + 32; // °F

  // Steadman / NWS simple formula (always compute first)
  let HI = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + rh * 0.094);
  // Average with T as NWS does for the threshold check
  HI = (HI + T) / 2;

  if (HI < 80) {
    // Below official HI domain — apparent temp ≈ dry-bulb
    return Math.round(tempC * 10) / 10;
  }

  // Full Rothfusz regression (°F)
  const c1 = -42.379;
  const c2 = 2.04901523;
  const c3 = 10.14333127;
  const c4 = -0.22475541;
  const c5 = -0.00683783;
  const c6 = -0.05481717;
  const c7 = 0.00122874;
  const c8 = 0.00085282;
  const c9 = -0.00000199;

  HI =
    c1 +
    c2 * T +
    c3 * rh +
    c4 * T * rh +
    c5 * T * T +
    c6 * rh * rh +
    c7 * T * T * rh +
    c8 * T * rh * rh +
    c9 * T * T * rh * rh;

  if (rh < 13 && T >= 80 && T <= 112) {
    HI -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (rh > 85 && T >= 80 && T <= 87) {
    HI += ((rh - 85) / 10) * ((87 - T) / 5);
  }

  const feelsC = ((HI - 32) * 5) / 9;
  return Math.round(feelsC * 10) / 10;
}

export type ComfortStatus = "Optimal" | "Slightly Humid" | "Stuffy" | "Cool" | "Warm";

export function comfortStatus(feelsC: number, rh: number): ComfortStatus {
  if (feelsC < 22) return "Cool";
  if (feelsC > 28 || rh >= 75) return "Stuffy";
  if (rh >= 65 || feelsC > 26.5) return "Slightly Humid";
  if (feelsC > 26) return "Warm";
  return "Optimal";
}
