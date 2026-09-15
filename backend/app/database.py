"""SQLite persistence for users (hackathon-friendly, zero external DB)."""

from __future__ import annotations

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
