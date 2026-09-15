"""Load appliance catalog (ACs + refrigerators) and research references."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA = Path(__file__).resolve().parent / "data" / "appliance_catalog.json"


@lru_cache
def load_catalog() -> dict:
    with open(_DATA, encoding="utf-8") as f:
        return json.load(f)


def list_acs() -> list[dict]:
    return load_catalog()["acs"]


def list_refrigerators() -> list[dict]:
    return load_catalog()["refrigerators"]


def get_catalog_item(item_id: str) -> dict | None:
    data = load_catalog()
    for row in data["acs"] + data["refrigerators"]:
        if row["id"] == item_id:
            return row
    return None


def research_refs() -> list[dict]:
    return load_catalog()["research"]
