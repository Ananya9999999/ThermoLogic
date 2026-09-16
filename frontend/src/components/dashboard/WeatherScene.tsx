/**
 * Full-viewport ambient weather scene: pastel theme from time + conditions,
 * slow-moving clouds, rain, sun glow, birds. Desktop-first.
 */
import { useEffect, useMemo, useState } from "react";
import "./WeatherScene.css";

export type SceneCondition = "clear" | "sunny" | "partly" | "cloudy" | "rain" | "storm" | "night";

type Props = {
  tempC?: number | null;
  humidity?: number | null;
  condition?: string | null;
  isNight?: boolean;
  children?: React.ReactNode;
};

export function resolveScene(
  condition: string | null | undefined,
  isNight: boolean,
  tempC: number | null | undefined
): SceneCondition {
  const c = (condition || "").toLowerCase();
  if (isNight) return "night";
  if (c.includes("thunder") || c.includes("storm")) return "storm";
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "rain";
  if (c.includes("cloud") || c.includes("overcast") || c.includes("fog")) return "cloudy";
  if (c.includes("part")) return "partly";
  if (c.includes("sun") || c.includes("clear")) return tempC != null && tempC >= 28 ? "sunny" : "clear";
  return isNight ? "night" : "partly";
}

/** Pastel palettes matching reference weather UIs */
export const SCENE_THEME: Record<
  SceneCondition,
  { bg: string; bg2: string; accent: string; text: string; soft: string; name: string }
> = {
  night: {
    bg: "#1a2744",
    bg2: "#2d3a5c",
    accent: "#c4b5fd",
    text: "#f0eef8",
    soft: "rgba(255,255,255,0.12)",
    name: "Night",
  },
  rain: {
    bg: "#5b7fa8",
    bg2: "#8fb4d4",
    accent: "#dbeafe",
    text: "#f8fafc",
    soft: "rgba(255,255,255,0.18)",
    name: "Rain",
  },
  storm: {
    bg: "#3d4f6f",
    bg2: "#5a6f92",
    accent: "#a5b4fc",
    text: "#f1f5f9",
    soft: "rgba(255,255,255,0.14)",
    name: "Storm",
  },
  sunny: {
    bg: "#fbbf77",
    bg2: "#fde68a",
    accent: "#fff7ed",
    text: "#3d2a12",
    soft: "rgba(255,255,255,0.35)",
    name: "Sunny",
  },
  clear: {
    bg: "#7dd3fc",
    bg2: "#bae6fd",
    accent: "#e0f2fe",
    text: "#0c4a6e",
    soft: "rgba(255,255,255,0.4)",
    name: "Clear",
  },
  partly: {
    bg: "#93c5fd",
    bg2: "#fde68a",
    accent: "#fef3c7",
    text: "#1e3a5f",
    soft: "rgba(255,255,255,0.35)",
    name: "Partly cloudy",
  },
  cloudy: {
    bg: "#94a3b8",
    bg2: "#cbd5e1",
    accent: "#f1f5f9",
    text: "#1e293b",
    soft: "rgba(255,255,255,0.28)",
    name: "Cloudy",
  },
};

export default function WeatherScene({
  tempC,
  humidity,
  condition,
  isNight: isNightProp,
  children,
}: Props) {
  const hour = new Date().getHours();
  const isNight = isNightProp ?? (hour < 6 || hour >= 19);
  const scene = useMemo(
    () => resolveScene(condition, isNight, tempC),
    [condition, isNight, tempC]
  );
  const theme = SCENE_THEME[scene];

  // Publish CSS variables for navbar/footer
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-weather-scene", scene);
    root.style.setProperty("--scene-bg", theme.bg);
    root.style.setProperty("--scene-bg2", theme.bg2);
    root.style.setProperty("--scene-accent", theme.accent);
    root.style.setProperty("--scene-text", theme.text);
    root.style.setProperty("--scene-soft", theme.soft);
    return () => {
      root.removeAttribute("data-weather-scene");
      root.style.removeProperty("--scene-bg");
      root.style.removeProperty("--scene-bg2");
      root.style.removeProperty("--scene-accent");
      root.style.removeProperty("--scene-text");
      root.style.removeProperty("--scene-soft");
    };
  }, [scene, theme]);

  return (
    <div className={`weather-scene scene-${scene}`} data-scene={scene}>
      <div className="ws-sky" />
      {(scene === "sunny" || scene === "clear" || scene === "partly") && (
        <div className="ws-sun" aria-hidden />
      )}
      {scene === "night" && (
        <>
          <div className="ws-moon" aria-hidden />
          <div className="ws-stars" aria-hidden />
        </>
      )}
      {(scene === "cloudy" || scene === "partly" || scene === "rain" || scene === "storm") && (
        <div className="ws-clouds" aria-hidden>
          <span className="ws-cloud c1" />
          <span className="ws-cloud c2" />
          <span className="ws-cloud c3" />
        </div>
      )}
      {(scene === "rain" || scene === "storm") && (
        <div className="ws-rain" aria-hidden>
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} style={{ left: `${(i * 7) % 100}%`, animationDelay: `${(i % 10) * 0.15}s` }} />
          ))}
        </div>
      )}
      {(scene === "sunny" || scene === "clear" || scene === "partly") && !isNight && (
        <div className="ws-birds" aria-hidden>
          <span className="ws-bird b1" />
          <span className="ws-bird b2" />
          <span className="ws-bird b3" />
        </div>
      )}
      <div className="ws-content">{children}</div>
    </div>
  );
}
