"""
Tracer SDK — token-level attribution instrumentation for LLM call chains.

Three primitives:
    trace.start(session_id)        — open an attribution window
    trace.log_call(...)            — record one LLM call in the chain
    trace.tag_outcome(...)         — close the loop with a business result

Wire this into any LLM workflow by calling log_call() around each API call.
"""

from datetime import datetime, timezone

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


def tag_outcome(session_id: str, outcome_type: str, outcome_value: float) -> None:
    """Close the attribution loop by tagging a business outcome against a session."""
    conn = get_db()
    conn.execute(
        "UPDATE sessions SET outcome_type = ?, outcome_value = ?, outcome_tagged_at = ? WHERE session_id = ?",
        (outcome_type, outcome_value, _now(), session_id),
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
