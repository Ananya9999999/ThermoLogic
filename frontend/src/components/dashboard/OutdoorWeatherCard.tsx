import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, CloudRain, Droplets, MapPin, Search, Volume2, VolumeX, Wind } from "lucide-react";
import {
  fetchByCity,
  fetchByCoords,
  getBrowserPosition,
  type OutdoorWeather,
  type WeatherCondition,
} from "./weatherService";
import "./OutdoorWeatherCard.css";

interface Props {
  defaultCity?: string;
  pollMs?: number;
  useGeolocation?: boolean;
  glass?: boolean;
}

export default function OutdoorWeatherCard({
  defaultCity = "Bengaluru",
  pollMs = 10 * 60 * 1000,
  useGeolocation = true,
  glass = false,
}: Props) {
  const [weather, setWeather] = useState<OutdoorWeather | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.35);
  const [cityInput, setCityInput] = useState("");
  const [status, setStatus] = useState("Locating…");
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    filter: BiquadFilterNode;
    source: AudioBufferSourceNode;
  } | null>(null);
  const queryRef = useRef<{ lat?: number; lon?: number; city?: string }>({});

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const apply = useCallback((w: OutdoorWeather) => {
    setWeather(w);
    setStatus(w.city);
    setError("");
  }, []);

  const load = useCallback(async () => {
    const q = queryRef.current;
    try {
      if (q.lat != null && q.lon != null) {
        apply(await fetchByCoords(q.lat, q.lon, q.city || "Current location"));
      } else if (q.city) {
        apply(await fetchByCity(q.city));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Weather unavailable");
    }
  }, [apply]);

  // Initial location resolve
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (useGeolocation) {
        try {
          const pos = await getBrowserPosition();
          if (cancelled) return;
          queryRef.current = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            city: "Current location",
          };
          setStatus("Current location");
          await load();
          return;
        } catch {
          /* fall through */
        }
      }
      if (cancelled) return;
      queryRef.current = { city: defaultCity };
      setCityInput(defaultCity);
      setStatus(defaultCity);
      setError("Using city search — allow location or pick another city.");
      await load();
    })();
    const id = setInterval(() => load(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [useGeolocation, defaultCity, load, pollMs]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = cityInput.trim();
    if (!q) return;
    setStatus(`Searching ${q}…`);
    queryRef.current = { city: q };
    try {
      apply(await fetchByCity(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "City not found");
    }
  };

  const onGps = async () => {
    setStatus("Locating…");
    try {
      const pos = await getBrowserPosition();
      queryRef.current = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        city: "Current location",
      };
      apply(await fetchByCoords(pos.coords.latitude, pos.coords.longitude));
    } catch {
      setError("Location denied — search by city name.");
    }
  };

  const w = weather;
  const condition: WeatherCondition = w?.condition || "Clouds";
  const isRain = condition === "Rain" || condition === "Thunderstorm";
  const bgClass =
    condition === "Clear" ? "clear" : condition === "Clouds" ? "clouds" : condition === "Mist" ? "mist" : "rain";

  // Rain canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isRain) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const intensity = Math.min(1, 0.2 + (w?.rainMmH || 1) / 6);
    const drops: { x: number; y: number; len: number; speed: number }[] = [];
    const count = Math.floor(50 + intensity * 140);
    const angle = 0.12 + intensity * 0.28;
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < count; i++) {
      drops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 8 + Math.random() * 16 * intensity,
        speed: 5 + Math.random() * 12 * intensity,
      });
    }
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = `rgba(200,220,255,${0.35 + intensity * 0.4})`;
      ctx.lineWidth = 1.2 * devicePixelRatio;
      for (const d of drops) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * angle, d.y + d.len);
        ctx.stroke();
        d.y += d.speed * devicePixelRatio;
        d.x += d.speed * angle * 0.35;
        if (d.y > canvas.height) {
          d.y = -10;
          d.x = Math.random() * canvas.width;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [isRain, w?.rainMmH]);

  // Web Audio rain
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.source.stop();
        audioRef.current.ctx.close();
      } catch {
        /* */
      }
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (muted || !isRain) {
      stopAudio();
      return;
    }
    const ctx = new AudioContext();
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const intensity = Math.min(1, 0.2 + (w?.rainMmH || 1) / 6);
    filter.frequency.value = 400 + intensity * 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume * (0.15 + intensity * 0.35);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    audioRef.current = { ctx, gain, filter, source };
    return () => stopAudio();
  }, [muted, isRain, volume, w?.rainMmH, stopAudio]);

  const timeStr = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const feels = w?.feelsLikeC ?? w?.tempC ?? "—";
  const temp = w?.tempC ?? "—";
  const hum = w?.humidity ?? "—";

  return (
    <div className={`owc ${glass ? "owc-glass" : ""}`} role="region" aria-label="Outdoor weather">
      <div className={`owc-bg ${bgClass}`} />
      {isRain && <canvas ref={canvasRef} className="owc-canvas" />}
      {condition === "Clear" && (
        <svg className="owc-sun" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="14" fill="#fff8e1" opacity="0.95" />
          <circle cx="32" cy="32" r="22" fill="#ffecb3" opacity="0.35" />
        </svg>
      )}
      {condition === "Clouds" && (
        <>
          <div className="owc-cloud c1" />
          <div className="owc-cloud c2" />
        </>
      )}
      <div className="owc-body">
        <form className="owc-search" onSubmit={onSearch}>
          <MapPin size={14} />
          <input
            type="text"
            placeholder="City (Mumbai, Delhi, …)"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            aria-label="City name"
          />
          <button type="submit" title="Search">
            <Search size={14} />
          </button>
          <button type="button" className="owc-geo" onClick={onGps} title="Use GPS">
            GPS
          </button>
        </form>
        {error && <div className="owc-error">{error}</div>}
        <div className="owc-top">
          <div>
            <div className="owc-label">Outdoor feels-like</div>
            <div className="owc-feels">
              {typeof feels === "number" ? feels.toFixed(1) : feels}
              <span>°C</span>
            </div>
            <div className="owc-condition">
              {isRain ? <CloudRain size={16} style={{ verticalAlign: -2, marginRight: 6 }} /> : <Cloud size={16} style={{ verticalAlign: -2, marginRight: 6 }} />}
              {condition}
              {isRain && w && w.rainMmH > 0 ? ` · ${w.rainMmH.toFixed(1)} mm/h` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="owc-clock">{timeStr}</div>
            <div className="owc-loc">
              <MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
              {status}
            </div>
          </div>
        </div>
        <div className="owc-metrics">
          <div className="owc-metric">
            <div className="k">Actual</div>
            <div className="v">{typeof temp === "number" ? `${temp.toFixed(1)}°C` : "—"}</div>
          </div>
          <div className="owc-metric">
            <div className="k">Humidity</div>
            <div className="v">
              <Droplets size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {typeof hum === "number" ? `${hum}%` : "—"}
            </div>
          </div>
          <div className="owc-metric">
            <div className="k">Wind</div>
            <div className="v">
              <Wind size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {w ? `${w.windKmh.toFixed(0)} km/h` : "—"}
            </div>
          </div>
        </div>
        {isRain && (
          <div className="owc-audio">
            <button type="button" onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {muted ? "Sound off" : "Rain sound"}
            </button>
            {!muted && (
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
