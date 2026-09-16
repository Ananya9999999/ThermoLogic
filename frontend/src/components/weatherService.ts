/** Open-Meteo current weather + geocoding — no API key required */

export type WeatherCondition = "Clear" | "Clouds" | "Rain" | "Thunderstorm" | "Mist";

export interface OutdoorWeather {
  tempC: number;
  humidity: number;
  condition: WeatherCondition;
  rainMmH: number;
  windKmh: number;
  city: string;
  feelsLikeC: number;
  lat: number;
  lon: number;
  source: string;
}

function mapWmo(code: number): WeatherCondition {
  if (code === 0) return "Clear";
  if (code <= 3) return "Clouds";
  if (code >= 45 && code <= 48) return "Mist";
  if (code >= 95) return "Thunderstorm";
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 61 && code <= 66)
  )
    return "Rain";
  if (code >= 71 && code <= 77) return "Clouds";
  return "Clouds";
}

/** Reverse-geocode lat/lon to a human city label (Nominatim / OSM, no key). */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}` +
      `&format=json&addressdetails=1&accept-language=en`;
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return "Current location";
    const j = await r.json();
    const a = j.address || {};
    const city =
      a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state;
    const region = a.state || a.region;
    const cc = (a.country_code || "").toUpperCase();
    const parts = [city, region !== city ? region : null, cc].filter(Boolean);
    if (parts.length) return parts.join(", ");
    if (j.display_name) return String(j.display_name).split(",").slice(0, 3).join(",").trim();
  } catch {
    /* ignore */
  }
  return "Current location";
}

export async function fetchByCoords(
  lat: number,
  lon: number,
  cityLabel = "Current location"
): Promise<OutdoorWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&wind_speed_unit=kmh&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Weather request failed");
  const j = await r.json();
  const c = j.current || {};
  return {
    tempC: Math.round((c.temperature_2m ?? 28) * 10) / 10,
    humidity: Math.round(c.relative_humidity_2m ?? 60),
    feelsLikeC: Math.round((c.apparent_temperature ?? c.temperature_2m ?? 28) * 10) / 10,
    rainMmH: Math.round((c.precipitation ?? 0) * 10) / 10,
    windKmh: Math.round((c.wind_speed_10m ?? 0) * 10) / 10,
    condition: mapWmo(Number(c.weather_code ?? 2)),
    city: cityLabel,
    lat,
    lon,
    source: "open-meteo",
  };
}

export async function fetchByCity(city: string): Promise<OutdoorWeather> {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const g = await fetch(geoUrl);
  if (!g.ok) throw new Error("Geocoding failed");
  const gj = await g.json();
  const place = gj.results?.[0];
  if (!place) throw new Error(`City not found: ${city}`);
  const label = [place.name, place.admin1, place.country_code].filter(Boolean).join(", ");
  return fetchByCoords(place.latitude, place.longitude, label);
}

function geoErrorMessage(err: GeolocationPositionError | Error): string {
  if ("code" in err) {
    if (err.code === 1) return "Location permission denied — search by city or click GPS again.";
    if (err.code === 2) return "Location unavailable — try city search.";
    if (err.code === 3) return "Location timed out — try city search or GPS again.";
  }
  return err.message || "Location failed";
}

/**
 * Get browser position. Tries high accuracy first, then a faster low-accuracy fallback.
 * Requires HTTPS (or localhost) and user permission.
 */
export function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported in this browser"));
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => resolve(pos);
    const tryLowAccuracy = () => {
      navigator.geolocation.getCurrentPosition(onSuccess, (err2) => {
        reject(new Error(geoErrorMessage(err2)));
      }, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5 * 60_000,
      });
    };

    navigator.geolocation.getCurrentPosition(onSuccess, () => {
      // High-accuracy failed — retry without it
      tryLowAccuracy();
    }, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60_000,
    });
  });
}