/** Mock simulation data for demo — mirrors the physics described in the pitch */

export type WeatherMode = "heatwave" | "smooth";

export interface TrajectoryPoint {
  hour: number;
  tOut: number;
  tInBaseline: number;
  tInMpc: number;
  uBaseline: number;
  uMpc: number;
  humidityBaseline: number;
  humidityMpc: number;
  price: number;
}

function generateTrajectory(mode: WeatherMode): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const n = 168; // one week, hourly
  for (let k = 0; k < n; k++) {
    const day = Math.floor(k / 24);
    const hourOfDay = k % 24;
    // Outdoor: base diurnal + heatwave spike on day 3-4
    let tOut = 28 + 6 * Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI);
    if (mode === "heatwave" && day >= 3 && day <= 4) {
      tOut += 8 + 3 * Math.sin(((hourOfDay - 14) / 24) * Math.PI);
    }
    // Price: peak 10-18, higher on weekdays
    const isPeak = hourOfDay >= 10 && hourOfDay <= 18;
    const price = isPeak ? 8.5 : 4.2; // ₹/kWh approx

    // Simplified indoor trajectories (illustrative of real simulator)
    const tMin = 22;
    const tMax = 26;
    // Baseline drifts more and overshoots during heatwave
    let tInBase =
      24 +
      0.35 * (tOut - 28) +
      (mode === "heatwave" && day >= 3 && day <= 4
        ? 1.8 * Math.sin(((hourOfDay - 15) / 24) * Math.PI)
        : 0);
    // Clamp with deadband reaction lag
    if (tInBase > tMax + 0.8) tInBase = tMax + 0.6;
    if (tInBase < tMin - 0.5) tInBase = tMin - 0.3;

    // MPC stays tighter, pre-cools
    let tInMpc =
      24 +
      0.15 * (tOut - 28) +
      (mode === "heatwave" && day >= 3 && day <= 4
        ? 0.4 * Math.sin(((hourOfDay - 13) / 24) * Math.PI)
        : 0);
    tInMpc = Math.max(tMin + 0.2, Math.min(tMax - 0.2, tInMpc));

    // Actuation intensity (0-1)
    const uBase =
      tInBase >= tMax - 0.3 ? 0.9 : tInBase <= tMin + 0.3 ? 0.7 : 0.05;
    const uMpc =
      mode === "heatwave" && day === 2 && hourOfDay > 18
        ? 0.45 // pre-cool
        : tInMpc > 24.5
        ? 0.55
        : 0.15;

    // Humidity: baseline drifts up while idle
    const humidityBase =
      52 +
      (uBase < 0.2 ? 0.08 * (k % 48) : -0.5) +
      (mode === "heatwave" ? 4 : 0);
    const humidityMpc = 50 + (uMpc > 0.3 ? -1.5 : 0.5);

    points.push({
      hour: k,
      tOut: +tOut.toFixed(1),
      tInBaseline: +tInBase.toFixed(1),
      tInMpc: +tInMpc.toFixed(1),
      uBaseline: +uBase.toFixed(2),
      uMpc: +uMpc.toFixed(2),
      humidityBaseline: +Math.min(72, Math.max(45, humidityBase)).toFixed(1),
      humidityMpc: +Math.min(58, Math.max(45, humidityMpc)).toFixed(1),
      price,
    });
  }
  return points;
}

export const heatwaveData = generateTrajectory("heatwave");
export const smoothData = generateTrajectory("smooth");

export function computeMetrics(data: TrajectoryPoint[]) {
  const energyBase = data.reduce((s, d) => s + d.uBaseline, 0) * 1.8; // kWh scale
  const energyMpc = data.reduce((s, d) => s + d.uMpc, 0) * 1.8;
  const savingsPct = ((energyBase - energyMpc) / energyBase) * 100;

  const comfortBase =
    (data.filter((d) => d.tInBaseline >= 22 && d.tInBaseline <= 26).length /
      data.length) *
    100;
  const comfortMpc =
    (data.filter((d) => d.tInMpc >= 22 && d.tInMpc <= 26).length /
      data.length) *
    100;

  const avgHumBase =
    data.reduce((s, d) => s + d.humidityBaseline, 0) / data.length;
  const avgHumMpc =
    data.reduce((s, d) => s + d.humidityMpc, 0) / data.length;

  const costBase = data.reduce((s, d) => s + d.uBaseline * d.price * 0.12, 0);
  const costMpc = data.reduce((s, d) => s + d.uMpc * d.price * 0.12, 0);

  return {
    energyBase: +energyBase.toFixed(1),
    energyMpc: +energyMpc.toFixed(1),
    savingsPct: +savingsPct.toFixed(1),
    comfortBase: +comfortBase.toFixed(1),
    comfortMpc: +comfortMpc.toFixed(1),
    avgHumBase: +avgHumBase.toFixed(1),
    avgHumMpc: +avgHumMpc.toFixed(1),
    costBase: +costBase.toFixed(0),
    costMpc: +costMpc.toFixed(0),
  };
}

/** Real-world impact numbers (India residential HVAC) */
export const impactNumbers = {
  savingsPct: "13–20%",
  annualSavingsInr: "₹2,400 – ₹4,800",
  perHouseholdNote:
    "Based on typical 1.5-ton AC (~1,200–1,800 kWh/yr cooling) and average DISCOM tariffs of ₹6–9/kWh across major metros.",
  cityScaleMwh: "42,000 – 68,000 MWh / year",
  cityScaleNote:
    "For a city of ~500,000 residential AC households (e.g. mid-size metro).",
  co2Tons: "34,000 – 55,000 tCO₂e / year",
  co2Note:
    "Using India’s grid emission factor ≈ 0.82 tCO₂/MWh (CEA).",
};
