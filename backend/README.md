# ThermoLogic Backend

FastAPI service for the ThermoLogic hackathon demo.

## What it does

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Status, feature flags, whether a weather key is configured |
| `GET /api/weather` | Outdoor + ToU price trace (live OWM or synthetic) |
| `POST /api/simulate` | Baseline deadband vs planning controller on the **same** weather |
| `POST /api/actuate` | Hardware path — **rejected** unless `ACTUATION_ENABLED=true` |
| `GET /api/impact` | ₹ / MWh / tCO₂ factors for the Impact page |

### Security

- `OPENWEATHER_API_KEY` is read only on the server (never sent to the browser).
- Live weather is optional (`USE_LIVE_WEATHER` / `?live=true`).
- Actuation is off by default.
- CORS locked to the Vite dev origins by default.

## Setup

```bash
cd thermologic-backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# optional: set OPENWEATHER_API_KEY and USE_LIVE_WEATHER=true
```

## Run

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open docs: http://127.0.0.1:8000/docs

## Example calls

```bash
# Health
curl http://127.0.0.1:8000/health

# Synthetic heatwave weather
curl "http://127.0.0.1:8000/api/weather?mode=heatwave&hours=48"

# Full simulation
curl -X POST http://127.0.0.1:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"mode":"heatwave","away":false,"comfort_nudge":0,"hours":168}'
```

## Frontend

Point the React app at this API (e.g. `VITE_API_URL=http://127.0.0.1:8000`).

## Fair comparison

Baseline = deadband hysteresis (breach → full power → hold to midpoint).  
MPC-style = short-horizon pre-cool + tariff-aware modulation.  
Same `t_out`, R, C, gains, band, and max power.
