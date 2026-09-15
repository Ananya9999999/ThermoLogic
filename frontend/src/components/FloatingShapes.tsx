import { useEffect, useRef } from "react";
import { Thermometer, Snowflake, Sun, Droplets, Home, Leaf, Wind, Gauge } from "lucide-react";
import "./FloatingShapes.css";

const ITEMS = [
  { Icon: Thermometer, top: "12%", left: "5%", speed: 0.06, size: 26, color: "var(--sage)" },
  { Icon: Snowflake, top: "20%", left: "90%", speed: 0.1, size: 22, color: "var(--slate)" },
  { Icon: Sun, top: "45%", left: "7%", speed: 0.08, size: 24, color: "var(--sand-deep)" },
  { Icon: Droplets, top: "60%", left: "92%", speed: 0.12, size: 20, color: "var(--slate-dark)" },
  { Icon: Home, top: "75%", left: "10%", speed: 0.07, size: 22, color: "var(--brown)" },
  { Icon: Leaf, top: "32%", left: "82%", speed: 0.09, size: 20, color: "var(--sage-dark)" },
  { Icon: Wind, top: "82%", left: "72%", speed: 0.11, size: 22, color: "var(--slate)" },
  { Icon: Gauge, top: "50%", left: "50%", speed: 0.05, size: 18, color: "var(--brown)" },
];

export default function FloatingShapes() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const nodes = Array.from(layer.querySelectorAll<HTMLElement>(".float-icon"));
    const onScroll = () => {
      const y = window.scrollY;
      nodes.forEach((el, i) => {
        const s = ITEMS[i].speed;
        const x = Math.sin((y + i * 130) * 0.003) * 22;
        const yy = y * s * (i % 2 === 0 ? 1 : -0.6);
        const r = Math.sin((y + i * 40) * 0.002) * 10;
        el.style.transform = `translate3d(${x}px, ${yy}px, 0) rotate(${r}deg)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="float-layer" ref={ref} aria-hidden>
      {ITEMS.map(({ Icon, top, left, size, color }, i) => (
        <div key={i} className="float-icon" style={{ top, left, color }}>
          <Icon size={size} strokeWidth={1.4} />
        </div>
      ))}
    </div>
  );
}
