"""SQLite connection and schema for Tracer session/trace persistence."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "tracer.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    prompt TEXT,
    outcome_type TEXT,
    outcome_value REAL,
    outcome_tagged_at TEXT,
    tagged_via TEXT DEFAULT 'manual'
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

CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    github_payload TEXT NOT NULL,
    session_id_extracted TEXT,
    outcome_tagged TEXT,
    received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outcome_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outcome_key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    value REAL NOT NULL,
    webhook_event TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

SEED_OUTCOME_TYPES = [
    ("pr_reviewed", "PR reviewed and merged", 120, "pull_request:merged"),
    ("bug_resolved", "Bug triaged and resolved", 200, "issues:closed:bug"),
    ("codegen_accepted", "Code generation accepted", 85, "pull_request_review:approved"),
    ("tests_generated", "Test suite generated", 150, None),
    ("ticket_resolved", "Support ticket resolved", 40, None),
    ("docs_drafted", "Documentation drafted", 60, None),
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    now = datetime.now(timezone.utc).isoformat()
    for outcome_key, label, value, webhook_event in SEED_OUTCOME_TYPES:
        conn.execute(
            """INSERT OR IGNORE INTO outcome_types
               (outcome_key, label, value, webhook_event, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (outcome_key, label, value, webhook_event, now, now),
        )
    conn.commit()
    conn.close()
