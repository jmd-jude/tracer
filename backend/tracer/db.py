"""SQLite connection and schema for Tracer session/trace persistence."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "tracer.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    prompt TEXT,
    outcome_type TEXT,
    outcome_value REAL,
    outcome_tagged_at TEXT
);

CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    call_label TEXT NOT NULL,
    call_order INTEGER NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    token_cost REAL NOT NULL,
    latency_ms INTEGER NOT NULL,
    output_text TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions (session_id)
);
"""


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
