"""SQLite persistence for users and appliances."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import get_settings


def _db_path() -> Path:
    return Path(get_settings().database_path)


def init_db() -> None:
    path = _db_path()
    with sqlite3.connect(path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS appliances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'ac',
                room TEXT NOT NULL DEFAULT 'Living room',
                tonnage REAL NOT NULL DEFAULT 1.5,
                iseer REAL NOT NULL DEFAULT 3.8,
                star INTEGER NOT NULL DEFAULT 3,
                power_w REAL NOT NULL DEFAULT 1400,
                catalog_id TEXT,
                t_min REAL NOT NULL DEFAULT 22.0,
                t_max REAL NOT NULL DEFAULT 26.0,
                enabled INTEGER NOT NULL DEFAULT 1,
                meta_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        # Migrations for existing DBs
        cols = {r[1] for r in conn.execute("PRAGMA table_info(appliances)").fetchall()}
        if "star" not in cols:
            conn.execute("ALTER TABLE appliances ADD COLUMN star INTEGER NOT NULL DEFAULT 3")
        if "power_w" not in cols:
            conn.execute("ALTER TABLE appliances ADD COLUMN power_w REAL NOT NULL DEFAULT 1400")
        if "catalog_id" not in cols:
            conn.execute("ALTER TABLE appliances ADD COLUMN catalog_id TEXT")
        conn.commit()


@contextmanager
def get_conn():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def create_user(email: str, name: str, password_hash: str) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
            (email.strip().lower(), name.strip(), password_hash),
        )
        uid = cur.lastrowid
        row = conn.execute(
            "SELECT id, email, name, created_at FROM users WHERE id = ?", (uid,)
        ).fetchone()
        return dict(row)


def get_user_by_email(email: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, name, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def list_appliances(user_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM appliances WHERE user_id = ? ORDER BY id",
            (user_id,),
        ).fetchall()
        return [_row_appliance(r) for r in rows]


def get_appliance(user_id: int, appliance_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM appliances WHERE id = ? AND user_id = ?",
            (appliance_id, user_id),
        ).fetchone()
        return _row_appliance(row) if row else None


def create_appliance(user_id: int, data: dict) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO appliances
            (user_id, name, kind, room, tonnage, iseer, star, power_w, catalog_id, t_min, t_max, enabled, meta_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                data["name"],
                data.get("kind", "ac"),
                data.get("room", "Living room"),
                data.get("tonnage", 1.5),
                data.get("iseer", 3.8),
                int(data.get("star", 3)),
                float(data.get("power_w", 1400)),
                data.get("catalog_id"),
                data.get("t_min", 22.0),
                data.get("t_max", 26.0),
                1 if data.get("enabled", True) else 0,
                json.dumps(data.get("meta") or {}),
            ),
        )
        aid = cur.lastrowid
        row = conn.execute("SELECT * FROM appliances WHERE id = ?", (aid,)).fetchone()
        return _row_appliance(row)


def update_appliance(user_id: int, appliance_id: int, data: dict) -> dict | None:
    existing = get_appliance(user_id, appliance_id)
    if not existing:
        return None
    merged = {**existing, **data}
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE appliances SET
                name=?, kind=?, room=?, tonnage=?, iseer=?,
                star=?, power_w=?, catalog_id=?,
                t_min=?, t_max=?, enabled=?, meta_json=?
            WHERE id=? AND user_id=?
            """,
            (
                merged["name"],
                merged["kind"],
                merged["room"],
                merged["tonnage"],
                merged["iseer"],
                int(merged.get("star", 3)),
                float(merged.get("power_w", 1400)),
                merged.get("catalog_id"),
                merged["t_min"],
                merged["t_max"],
                1 if merged.get("enabled", True) else 0,
                json.dumps(merged.get("meta") or {}),
                appliance_id,
                user_id,
            ),
        )
        row = conn.execute(
            "SELECT * FROM appliances WHERE id = ? AND user_id = ?",
            (appliance_id, user_id),
        ).fetchone()
        return _row_appliance(row)


def delete_appliance(user_id: int, appliance_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM appliances WHERE id = ? AND user_id = ?",
            (appliance_id, user_id),
        )
        return cur.rowcount > 0


def _row_appliance(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["enabled"] = bool(d.get("enabled", 1))
    try:
        d["meta"] = json.loads(d.pop("meta_json", "{}") or "{}")
    except json.JSONDecodeError:
        d["meta"] = {}
    return d
