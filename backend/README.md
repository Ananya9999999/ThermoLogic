<<<<<<< HEAD
# ThermoLogic Backend

FastAPI service: weather, simulation, energy calculator, JWT auth.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status |
| GET | `/api/reference` | Website claim data (BEE, CEA, tariffs, presets) |
| GET | `/api/impact` | Impact figures for UI |
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Current user (Bearer token) |
| GET | `/api/weather` | Live or synthetic outdoor + prices |
| POST | `/api/simulate` | Baseline vs planner (tunable building/tariff) |
| POST | `/api/calculator` | Annual ₹ / kWh / CO₂ from household params |
| POST | `/api/actuate` | Gated hardware stub |

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Auth

SQLite file `thermologic.db` stores users. Passwords hashed with bcrypt. JWT secret via `JWT_SECRET`.
=======
# ThermoLogic
>>>>>>> 4d217a9f74d3ce76d1a8be779dc3f71d888d86d1
