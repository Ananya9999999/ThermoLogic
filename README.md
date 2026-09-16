# ThermoLogic

**An intelligent thermostat system that adapts heating/cooling in real time using occupancy, weather, and usage-pattern data to reduce energy consumption while maintaining comfort.**

> A controller that thinks ahead instead of reacting after the fact.

---

## Table of contents

1. [Mission](#1-mission)
2. [Two account modes](#2-two-account-modes)
3. [Architecture](#3-architecture)
4. [Core control ideas](#4-core-control-ideas)
5. [Features (full list)](#5-features-full-list)
6. [Backend API](#6-backend-api)
7. [Frontend pages & routes](#7-frontend-pages--routes)
8. [Key algorithms](#8-key-algorithms)
9. [Data & persistence](#9-data--persistence)
10. [Setup & run](#10-setup--run)
11. [Environment variables](#11-environment-variables)
12. [Project structure](#12-project-structure)
13. [Normal vs corporate isolation](#13-normal-vs-corporate-isolation)
14. [Firmware](#14-firmware)
15. [Roadmap / known gaps](#15-roadmap--known-gaps)

---

## 1. Mission

ThermoLogic is not a simple on/off thermostat. It:

- Measures **comfort** primarily via **feels-like temperature** (Apparent Temperature / heat index), not dry-bulb alone.
- Uses **outdoor weather + multi-hour forecast** to plan cooling/drying *before* heat or humidity peaks arrive.
- Learns **time-of-day preferences** and occupancy patterns so the next day needs less manual adjustment.
- Separates **home (normal user)** behaviour from **corporate / industrial** process control (cold rooms, freezers, warehouses).

Every degree the setpoint can be raised safely (because humidity is controlled) typically saves roughly **3–5% compressor energy**.

---

## 2. Two account modes

On sign-in / sign-up the user chooses **Normal** or **Corporate**. Choice is stored as `localStorage.tl_account_kind`.

| | **Normal user (home)** | **Corporate (industrial)** |
|---|------------------------|----------------------------|
| Use case | Split/window AC, heater, heat pump in living spaces | Warehouses, cold rooms, freezers, pharma, hotels, greenhouses |
| Comfort metric | **Feels-like** (temp + humidity) | **Process dry-bulb** vs band min–max |
| Temperature range | **16–30 °C** fixed residential band | Zone profile (can be **sub-zero**, e.g. −22…−18 °C) |
| Modes | Cool / Dry / Heat / Idle | Cool / refrigerate / hold / idle (industrial rules) |
| Profiles page | **Hidden** | Multi-site / multi-zone profiles |
| Forecast plan | 24 h outdoor + mode plan shown | Hidden for industrial zones |
| Calendar / occupancy | Shown on dashboard | Optional / industrial-focused |

**Important:** Normal and corporate Control Centre data must stay **separated**. Industrial zone limits must never leak into home mode.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite + TypeScript)                       │
│  Dashboard · Control Centre · Corporate · Calculator · Auth │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST + JWT
┌──────────────────────────▼──────────────────────────────────┐
│  Backend (FastAPI + SQLite)                                 │
│  weather · live_control · simulator · personalization       │
│  occupancy · forecast_bias · auth · appliances · calculator │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  OpenWeatherMap     Synthetic fallback   Local SQLite
  (forecast/current) (demo offline)       users, profiles,
                                          appliances
```

Optional: ESP-style firmware sketch for heat-index-aware local control (`firmware/`).

---

## 4. Core control ideas

### Feels-like first (home)

Discomfort is often **humidity**, not dry-bulb. Users often drop the AC to 20–22 °C because air feels sticky. ThermoLogic instead:

1. Monitors humidity and **raises the dry-bulb target** when RH is high (setpoint shift), while holding **feels-like** in the comfort band.
2. Prefers **Dry / low-fan style** behaviour when humidity drives the problem (more latent removal per cycle).
3. Uses forecast so the compressor ramps **before** outdoor peaks → fewer sudden energy spikes.

### Industrial process control (corporate)

- No heat-index. Control is **process temperature vs saved band**.
- Above band max → cool / refrigerate.  
- Inside band → idle (hold).  
- Below band (e.g. freezer already colder than target) → idle (avoid over-freeze).

### Proactive, not reactive

Forecast + time-of-day profiles + occupancy schedule produce a **plan**. The live controller follows the plan and only overrides for force mode or safety.

---

## 5. Features (full list)

### Authentication & accounts
- Email/password signup & login (JWT, bcrypt).
- Normal vs corporate account kind.
- Protected routes; corporate-only Profiles route.

### Dashboard (home)
- Auto **live location** (browser geolocation) with city search fallback.
- Outdoor actual temp, feels-like, humidity, wind, condition.
- Ambient weather scene theming.
- Google Calendar / schedule + occupancy optimizer strip (home only).
- CTA into Control Centre.

### Control Centre (Live Hub)
- **Room / process state** demo sliders (raw temp + humidity).
- Live **feels-like** (home) or **process temp** (industrial).
- Thermostat remote: min–max band, dial, Force lock vs Auto.
- Modes: auto / cool / dry / heat / idle.
- **24 h plan** grouped by period (early morning → night) with outdoor data (home).
- Tariff effort curve (prefer cheap hours).
- Clickable **?** help for feels-like, dry mode, plan, profiles, tariff.
- Time-of-day comfort profile edit + save (14-day style memory on server).

### Corporate dashboard & profiles
- Multi-site, multi-zone profiles (warehouse, cold chilled/frozen/deep, pharma, hotel, greenhouse, etc.).
- Hard min/max, RH, freeze rules, compliance tags, priority (precision / energy / balanced).
- Live process control using zone band; industrial algorithm.
- Negative and wide process temperatures supported on API (−100…+100 °C).

### Weather
- Live OpenWeatherMap forecast (server-side API key) or synthetic heatwave/smooth traces.
- Current conditions endpoint for dashboard cards.
- Forecast bias corrector (learn systematic forecast error).

### Simulation & energy
- Baseline deadband thermostat vs ThermoLogic predictive / humidity-aware controller.
- Metrics: kWh, ₹ cost, comfort %, average humidity & feels-like, savings %.
- Energy calculator (tonnage, ISEER, hours, tariff → annual ₹ / kWh / CO₂).
- Reference impact figures (BEE / grid style claims for UI).

### Personalization & learning
- LinUCB **ComfortBandBandit** for suggested t_min / t_max / humidity band from overrides.
- Time-of-day slots + history (personalization module).
- Occupancy predictor from observations → schedule probabilities.
- Forecast bias buckets by lead time.

### Other UI
- Marketing home, about, architecture, impact, terms.
- Demo page, savings calculator.
- Appliance catalog (tonnage, star rating, power) for multi-appliance dashboard sim.

---

## 6. Backend API

Base: `http://127.0.0.1:8000` (configurable).

### Health & reference
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status, live weather flag, API key presence, city |
| GET | `/api/reference` | BEE / tariffs / presets claim data |
| GET | `/api/impact` | Impact figures for marketing UI |

### Auth
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/signup` | Create user (+ seed default AC) |
| POST | `/api/auth/login` | JWT |
| GET | `/api/auth/me` | Current user (Bearer) |

### Appliances
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/appliances` | List / create |
| PATCH/DELETE | `/api/appliances/{id}` | Update / delete |

### Weather & simulation
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/weather` | Hourly outdoor + prices (live or synthetic) |
| GET | `/api/weather/current` | Current outdoor card payload |
| POST | `/api/simulate` | Baseline vs MPC trajectory |
| GET | `/api/dashboard` | Multi-appliance aggregate sim |
| POST | `/api/calculator` | Annual savings calculator |
| POST | `/api/actuate` | Gated hardware stub |

### Live control (Control Centre)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/live-control` | Decision: mode, feels band, day plan, reason |
| GET/PUT | `/api/comfort-profiles` | Time-of-day feels min/max profiles |
| GET | `/api/heat-index` | Utility feels-like from T + RH |

### Learning
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/occupancy/observe` | Log occupancy |
| GET | `/api/occupancy/schedule` | Predicted occupancy schedule |
| POST | `/api/comfort-band` | Override → update LinUCB bandit |
| GET | `/api/personalization` | Suggested band + confidence |
| GET/POST | `/api/forecast-bias` | Bias snapshot / observe |

---

## 7. Frontend pages & routes

| Route | Page | Notes |
|-------|------|--------|
| `/` | Home / gate | Redirects signed-in users by account kind |
| `/login`, `/signup` | Auth | Sets `tl_account_kind` |
| `/app` | DashboardHome | Live weather + calendar (home) |
| `/app/control` | LiveHub | Control Centre + LiveControlPanel |
| `/app/profiles` | Profiles | **Corporate only** |
| `/app/corporate` | CorporateDashboard | Sites / zones / industrial view |
| `/app/calculator` | Calculator | Annual energy / ₹ / CO₂ |
| `/impact`, `/about`, `/terms` | Marketing / legal | |
| Demo / Architecture | Supporting product pages | |

Nav links adapt: Profiles and Corporate only when `tl_account_kind === "corporate"`.

---

## 8. Key algorithms

### Heat index / feels-like
- Frontend and backend share a heat-index style formula for home comfort.
- Recommended evolution: **Australian BoM indoor Apparent Temperature** (no wind):

```text
e  = (RH/100) × 6.105 × exp(17.27 × Ta / (237.7 + Ta))
AT = Ta + 0.33 × e − 4.00
```

### Live control (home)
1. Compute feels-like from room T + RH.
2. Load active period band (or forced min/max).
3. If high feels-like driven by humidity → **dry**; if sensible heat → **cool**; low → **heat**; else **idle**.
4. Blend short forecast to pre-cool/pre-dry.
5. Respect Force mode when locked.

### Live control (industrial)
1. Compare process temp to band min/max from zone profile.
2. Above max → cool; in band → idle; below min → idle (no over-freeze).
3. No feels-like; no home 24 h plan UI.

### Simulator
- Baseline: classic deadband hysteresis.
- ThermoLogic path: humidity-aware + cost-aware short horizon + optional forecast plan.
- Outputs trajectory points (T_in, u, humidity, feels, mode) and energy/comfort metrics.

### Personalization
- LinUCB arms for t_min, t_max, h_min, h_max with context (hour, outdoor T/RH, day of week).
- Time-of-day slots with optional 14-day observation history.

---

## 9. Data & persistence

| Store | What |
|-------|------|
| SQLite `thermologic.db` | Users, appliances, comfort profiles, override log |
| localStorage | `tl_account_kind`, JWT token, multi-site/zone profiles (`tl_sites`, active site/zone) |
| In-memory (process) | Occupancy model, LinUCB bandit, forecast bias (reset on restart unless persisted later) |

Comfort profile history is intended to retain ~**14 days** of overrides for learning.

---

## 10. Setup & run

### Backend

```bash
cd backend
python3 -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
# optional: copy .env.example → .env and set OPENWEATHER_API_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
# optional: echo VITE_API_URL=http://127.0.0.1:8000 > .env
npm run dev
```

Open the Vite URL (usually `http://127.0.0.1:5173`). Sign up, choose Normal or Corporate, then use Dashboard → Control Centre.

### Health check

```bash
curl http://127.0.0.1:8000/health
```

---

## 11. Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `OPENWEATHER_API_KEY` | empty | Live forecast; without it, synthetic weather |
| `USE_LIVE_WEATHER` | true | Prefer live when key present |
| `DEFAULT_CITY` | Bengaluru | Fallback city |
| `DEFAULT_LAT` / `DEFAULT_LON` | 12.97 / 77.59 | Fallback coordinates |
| `JWT_SECRET` | dev string | **Change in production** |
| `JWT_EXPIRE_HOURS` | 72 | Token lifetime |
| `CORS_ORIGINS` | localhost:5173 | Allowed frontends |
| `DATABASE_PATH` | thermologic.db | SQLite file |
| Thermal / tariff params | see `config.py` | R, C, u_cool_max, peak hours, ₹/kWh |

Frontend: `VITE_API_URL` → backend base URL.

---

## 12. Project structure

```
ThermoLogic/
├── README.md
├── FEATURES_LIVE_CONTROL.md
├── LICENSE
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI routes
│   │   ├── config.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── models.py            # Pydantic schemas
│   │   ├── weather.py
│   │   ├── heat_index.py
│   │   ├── live_control.py      # Live decision engine
│   │   ├── simulator.py         # Baseline vs smart trajectory
│   │   ├── personalization.py   # LinUCB + slots / plan helpers
│   │   ├── occupancy_model.py
│   │   ├── forecast_bias.py
│   │   ├── calculator.py
│   │   ├── catalog.py / data/
│   │   ├── ml_model.py
│   │   └── reference_data.py
│   ├── requirements.txt
│   └── run.sh
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routes + CorporateOnly gate
│   │   ├── api.ts
│   │   ├── context/AuthContext.tsx
│   │   ├── lib/profileStore.ts  # Sites/zones + residential limits
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   └── dashboard/
│   │   │       ├── LiveControlPanel.tsx
│   │   │       ├── WeatherScene.tsx
│   │   │       ├── ScheduleOccupancyOptimizer.tsx
│   │   │       └── …
│   │   └── pages/
│   │       ├── DashboardHome.tsx
│   │       ├── LiveHub.tsx
│   │       ├── CorporateDashboard.tsx
│   │       ├── Profiles.tsx
│   │       ├── Calculator.tsx
│   │       └── …
│   └── package.json
└── firmware/
    └── heat_index_controller.ino
```

---

## 13. Normal vs corporate isolation

Implemented so corporate industrial changes do **not** break home users:

1. **Navbar** — Profiles link only if corporate.
2. **App routes** — `/app/profiles` redirects non-corporate to `/app`.
3. **profileStore** — `RESIDENTIAL_LIMITS` (16–30 °C); `controlLimitsForZone(..., { forceResidential: true })` for home.
4. **LiveControlPanel** — Home always residential sliders/band; `industrial: true` only when corporate **and** zone is industrial.

Corporate keeps:

- API acceptance of −100…+100 °C process temps/bands.
- Industrial algorithm (dry-bulb vs band).
- Hidden 24 h outdoor plan for industrial zones.
- Labels: Process temp / Band min–max.

---

## 14. Firmware

`firmware/heat_index_controller.ino` — sketch-oriented controller using heat-index style comfort for embedded/IR or serial thermostat demos. Backend `actuation` remains gated (`ACTUATION_ENABLED`) for safety.

---

## 15. Roadmap / known gaps

- Persist occupancy bandit / bias models to SQLite across restarts.
- Wire ML forecast module more tightly into live_control (beyond graph demos).
- Stronger Google Calendar → occupancy → away flag closed loop.
- Optional switch of feels-like fully to BoM indoor AT everywhere.
- Production JWT secret, HTTPS, and rate limiting.
- Real hardware actuation adapters (IR / serial) behind the existing actuate stub.

---

## License

MIT (see `LICENSE`).

---

## Quick mental model

**Home:**  
Weather + feels-like + humidity + time-of-day profiles → plan → live cool/dry/heat while saving energy.

**Corporate:**  
Zone profile band + process temperature → hold or refrigerate; freezers and cold chain stay in band without home comfort UI.

**Both:**  
Think ahead with forecast; do not wait for the room (or process) to already be uncomfortable.
