# ThermoLogic Frontend

Hackathon UI for the forecast-aware smart thermostat demo.

## Features

- **Multi-page navigation**: Dashboard, Live Demo, Impact, Architecture, About Us, Terms
- **Light theme only** — soft blues/teals, white surfaces, no dark mode, no neon
- **Live Demo** page with:
  - Heatwave ↔ Smooth weather toggle
  - Home / Away occupancy (comfort band widens when away)
  - Personalization slider (stub)
  - Temperature, humidity, and tariff-actuation charts
  - Written 60–90 second pitch script
- **Impact** page with ₹ / MWh / tCO₂ conversion math for India residential HVAC
- **Architecture** one-pager: Forecast → Thermal model → MPC/LP → Actuation → Dashboard

## Quick start

```bash
cd thermologic-frontend
npm install
npm run dev
```

Open the URL Vite prints (typically http://localhost:5173).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |

## Pages

| Path | Content |
|------|---------|
| `/` | Dashboard — metrics + heatwave trajectory |
| `/demo` | Interactive demo + pitch script |
| `/impact` | Real-world savings in ₹, MWh, CO₂ |
| `/architecture` | Pipeline diagram + next steps |
| `/about` | Mission & team |
| `/terms` | Terms & conditions |

## Stack

- React 19 + TypeScript
- Vite
- React Router
- Recharts
- Lucide icons

## Notes for judges / pitch

Use the **Live Demo** page and follow the numbered script at the bottom of that page. Key beats:

1. Pre-cool trajectory on heatwave
2. Smooth weather → savings still hold (tariff timing)
3. Humidity: baseline drifts, ours doesn’t
4. Away + personalization controls
