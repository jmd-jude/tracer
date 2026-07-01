"""
Tracer SDK — token-level attribution instrumentation for LLM call chains.

Three primitives:
    trace.start(session_id)        — open an attribution window
    trace.log_call(...)            — record one LLM call in the chain
    trace.tag_outcome(...)         — close the loop with a business result

Wire this into any LLM workflow by calling log_call() around each API call.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from tracer.db import get_db

# Sonnet 4.6 pricing, USD per million tokens.
PRICING_PER_MILLION = {
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Compute USD cost for a call given its token counts and model."""
    rates = PRICING_PER_MILLION.get(model, PRICING_PER_MILLION["claude-sonnet-4-6"])
    return (input_tokens / 1_000_000) * rates["input"] + (output_tokens / 1_000_000) * rates["output"]


def start(session_id: str) -> None:
    """Open a new attribution window for a chain of LLM calls."""
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (session_id, created_at) VALUES (?, ?)",
        (session_id, _now()),
    )
    conn.commit()
    conn.close()
    Path(".tracer").write_text(session_id)


def log_call(
    session_id: str,
    call_label: str,
    call_order: int,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    output_text: str = "",
) -> float:
    """
    Record one LLM call in the chain and return its computed token cost in USD.

    call_order determines position in the chain (0-indexed), which the
    attribution engine uses for recency-weighted credit distribution.
    """
    token_cost = calculate_cost(model, input_tokens, output_tokens)
    conn = get_db()
    conn.execute(
        """INSERT INTO calls
           (session_id, call_label, call_order, model, input_tokens, output_tokens,
            token_cost, latency_ms, output_text, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            session_id,
            call_label,
            call_order,
            model,
            input_tokens,
            output_tokens,
            token_cost,
            latency_ms,
            output_text,
            _now(),
        ),
    )
    conn.commit()
    conn.close()
    return token_cost


def set_prompt(session_id: str, prompt: str) -> None:
    """Attach the originating prompt to a session, for display in session history."""
    conn = get_db()
    conn.execute("UPDATE sessions SET prompt = ? WHERE session_id = ?", (prompt, session_id))
    conn.commit()
    conn.close()


def tag_outcome(session_id: str, outcome_type: str, outcome_value: float, via: str = "manual") -> None:
    """Close the attribution loop by tagging a business outcome against a session."""
    conn = get_db()
    conn.execute(
        "UPDATE sessions SET outcome_type = ?, outcome_value = ?, outcome_tagged_at = ?, tagged_via = ? WHERE session_id = ?",
        (outcome_type, outcome_value, _now(), via, session_id),
    )
    conn.commit()
    conn.close()


def get_session(session_id: str) -> dict | None:
    """Fetch a session row, or None if it doesn't exist."""
    conn = get_db()
    row = conn.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_calls(session_id: str) -> list[dict]:
    """Fetch all calls for a session, ordered by call_order."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM calls WHERE session_id = ? ORDER BY call_order", (session_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_recent_sessions(limit: int = 10) -> list[dict]:
    """Fetch the most recent tagged sessions with their total cost, for the history panel."""
    conn = get_db()
    rows = conn.execute(
        """SELECT s.session_id, s.prompt, s.outcome_type, s.outcome_value, s.created_at, s.tagged_via,
                  SUM(c.token_cost) AS total_cost
           FROM sessions s
           LEFT JOIN calls c ON c.session_id = s.session_id
           WHERE s.outcome_value IS NOT NULL
           GROUP BY s.session_id
           ORDER BY s.created_at DESC
           LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def log_webhook_event(
    event_type: str,
    github_payload: dict,
    session_id_extracted: str | None,
    outcome_tagged: str | None,
) -> None:
    """Record an inbound GitHub webhook event for the debug/demo panel."""
    conn = get_db()
    conn.execute(
        """INSERT INTO webhook_events
           (event_type, github_payload, session_id_extracted, outcome_tagged, received_at)
           VALUES (?, ?, ?, ?, ?)""",
        (event_type, json.dumps(github_payload), session_id_extracted, outcome_tagged, _now()),
    )
    conn.commit()
    conn.close()


def list_webhook_events(limit: int = 20) -> list[dict]:
    """Fetch the most recent inbound webhook events, for the debug/demo panel."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_outcome_types() -> list[dict]:
    """Fetch all outcome types, ordered by creation order."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM outcome_types ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_outcome_type(outcome_key: str) -> dict | None:
    """Fetch a single outcome type by its key, or None if it doesn't exist."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM outcome_types WHERE outcome_key = ?", (outcome_key,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_outcome_type_by_webhook_event(webhook_event: str) -> dict | None:
    """Fetch the outcome type mapped to a webhook event pattern, or None if unmapped."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM outcome_types WHERE webhook_event = ?", (webhook_event,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def create_outcome_type(
    outcome_key: str, label: str, value: float, webhook_event: str | None = None
) -> dict:
    """Create a new outcome type and return the created row."""
    conn = get_db()
    now = _now()
    conn.execute(
        """INSERT INTO outcome_types (outcome_key, label, value, webhook_event, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (outcome_key, label, value, webhook_event, now, now),
    )
    conn.commit()
    conn.close()
    return get_outcome_type(outcome_key)


def update_outcome_type(
    outcome_key: str, label: str, value: float, webhook_event: str | None = None
) -> dict:
    """Update an existing outcome type's label, value, and webhook mapping."""
    conn = get_db()
    conn.execute(
        """UPDATE outcome_types SET label = ?, value = ?, webhook_event = ?, updated_at = ?
           WHERE outcome_key = ?""",
        (label, value, webhook_event, _now(), outcome_key),
    )
    conn.commit()
    conn.close()
    return get_outcome_type(outcome_key)


def delete_outcome_type(outcome_key: str) -> None:
    """Delete an outcome type. Raises ValueError if it's referenced by any session."""
    conn = get_db()
    count = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE outcome_type = ?", (outcome_key,)
    ).fetchone()[0]
    if count > 0:
        conn.close()
        raise ValueError(f"This outcome has been used in {count} sessions and cannot be deleted.")
    conn.execute("DELETE FROM outcome_types WHERE outcome_key = ?", (outcome_key,))
    conn.commit()
    conn.close()
