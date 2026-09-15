#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi
# Prefer venv uvicorn; fall back to python -m
if [[ -x .venv/bin/uvicorn ]]; then
  exec .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
else
  exec .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
fi
