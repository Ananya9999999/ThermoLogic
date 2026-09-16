# ThermoLogic — Live Dynamic Control (added)

## What was added

### 1. Live room simulator (sliders)
- Raw temperature + humidity percentage sliders on the Control Centre (`LiveControlPanel`).
- Feels-like temperature updates instantly using the NWS Heat Index (same formula as backend).
- Comfort status badge (Optimal / Slightly Humid / Stuffy / Cool / Warm).

### 2. Live algorithm that re-decides on every change
Endpoint: `POST /api/live-control`

Re-runs whenever:
- You move the room temp / humidity sliders
- You force a mode or setpoint
- Outdoor weather / forecast updates (polled every ~45s and on demand)

**Control logic**
1. Compare current Feels-Like against the active comfort band (time-of-day profile).
2. If Feels-Like is high **mainly because of humidity** → **Dry mode** (moisture removal + mild cool) instead of brute-force Cool.
3. If dry heat → Cool. If below band → Heat. Inside band with high RH → light Dry.
4. Short forecast look-ahead (next hours) pre-conditions so there is no sudden spike in compressor load.
5. User force mode / setpoint always wins, but the reason string still explains the physics.

### 3. Forecast-aware day plan
- Uses live OpenWeatherMap (or synthetic fallback).
- Builds a 24-hour mode strip (idle / dry / cool / heat) from outdoor forecast + your profiles.
- Avoids sudden energy spikes by planning Dry/Cool before the outdoor peak.

### 4. Clickable feature descriptions
- `?` buttons next to Feels-like, Dry mode, plan, profiles, and energy note open short explanations.

### 5. Time-of-day comfort profiles (14-day memory)
Periods: early morning, morning, noon, evening, night.

Endpoints:
- `GET /api/comfort-profiles`
- `PUT /api/comfort-profiles`

Stored in SQLite (`comfort_profiles` + `comfort_overrides_log` pruned to 14 days).

## How to run

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# optional: set OPENWEATHER_API_KEY in .env
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
# optional: echo 'VITE_API_URL=http://127.0.0.1:8000' > .env
npm run dev
```

Open **Control Centre** (Live Hub) while signed in. Use the **Live room control** card at the top.

## Key files
- `backend/app/live_control.py` — decision engine
- `backend/app/database.py` — profile tables
- `backend/app/main.py` — `/api/live-control`, `/api/comfort-profiles`, `/api/heat-index`
- `frontend/src/components/dashboard/LiveControlPanel.tsx` — UI + live loop
- `frontend/src/api.ts` — client helpers
