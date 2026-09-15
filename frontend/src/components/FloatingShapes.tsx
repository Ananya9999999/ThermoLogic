import { useEffect, useRef } from "react";
import {
  Thermometer,
  Snowflake,
  Sun,
  Droplets,
  Home,
  Leaf,
  Wind,
  Gauge,
} from "lucide-react";
import "./FloatingShapes.css";

const ITEMS = [
  { Icon: Thermometer, top: "10%", left: "6%", speed: 0.07, size: 28, color: "var(--sage)" },
  { Icon: Snowflake, top: "18%", left: "88%", speed: 0.11, size: 24, color: "var(--slate)" },
  { Icon: Sun, top: "42%", left: "8%", speed: 0.09, size: 26, color: "var(--sand)" },
  { Icon: Droplets, top: "58%", left: "90%", speed: 0.13, size: 22, color: "var(--slate-dark)" },
  { Icon: Home, top: "72%", left: "12%", speed: 0.08, size: 24, color: "var(--brown)" },
  { Icon: Leaf, top: "30%", left: "78%", speed: 0.1, size: 22, color: "var(--sage-dark)" },
  { Icon: Wind, top: "80%", left: "70%", speed: 0.12, size: 24, color: "var(--slate)" },
  { Icon: Gauge, top: "48%", left: "48%", speed: 0.06, size: 20, color: "var(--brown)" },
];

export default function FloatingShapes() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const nodes = Array.from(layer.querySelectorAll<HTMLElement>(".float-icon"));

    const onScroll = () => {
      const y = window.scrollY;
      nodes.forEach((el, i) => {
        const speed = ITEMS[i].speed;
        const xDrift = Math.sin((y + i * 140) * 0.0035) * 24;
        const yDrift = y * speed * (i % 2 === 0 ? 1 : -0.65);
        const rot = Math.sin((y + i * 50) * 0.002) * 12;
        el.style.transform = `translate3d(${xDrift}px, ${yDrift}px, 0) rotate(${rot}deg)`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="float-layer" ref={layerRef} aria-hidden>
      {ITEMS.map(({ Icon, top, left, size, color }, i) => (
        <div
          key={i}
          className="float-icon"
          style={{ top, left, color }}
        >
          <Icon size={size} strokeWidth={1.5} />
        </div>
      ))}
    </div>
  );
}
