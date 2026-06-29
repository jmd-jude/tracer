"""
Populate Tracer with realistic-looking demo sessions.

Runs a handful of real chain calls against the Anthropic API with loosened,
detail-seeking system prompts and a higher max_tokens ceiling than the live
app uses, so the resulting token counts and costs look like what a team
lead would actually see on an invoice. The live app's CHAIN_STEPS prompts
in app.py are untouched — this is a separate, deliberately verbose pass
used only to seed demo data.

Usage (from backend/, with the venv active):
    python scripts/seed_verbose.py
"""

import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anthropic import Anthropic
from dotenv import load_dotenv

from tracer import sdk
from tracer.db import init_db

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096

VERBOSE_CHAIN_STEPS = [
    {
        "label": "Retrieval",
        "system": (
            "You are a retrieval system. Given a user prompt, do a deep, thorough pass over "
            "the relevant background context, prior art, and technical considerations a "
            "downstream reasoning step would need. Be comprehensive — write several full "
            "paragraphs covering nuance, caveats, and concrete specifics, not a quick bullet list."
        ),
    },
    {
        "label": "Reasoning",
        "system": (
            "You are a reasoning system. Given a user prompt and retrieved context, analyze "
            "the problem in depth and structure a thorough response approach. Write a detailed, "
            "multi-paragraph breakdown of your reasoning, covering tradeoffs and alternative "
            "approaches, not a short outline."
        ),
    },
    {
        "label": "Generation",
        "system": (
            "You are a generation system. Given a user prompt, retrieved context, and a "
            "structured approach, produce a comprehensive, thorough, and complete final "
            "user-facing output. Be detailed and exhaustive — this is a complete, "
            "production-quality answer, not a quick summary."
        ),
    },
]

SEED_SESSIONS = [
    {
        "prompt": (
            "Walk me through implementing a Redis-based rate limiter for a Flask API, "
            "including edge cases and failure modes."
        ),
        "outcome_type": "bug_resolved",
        "outcome_value": 200,
    },
    {
        "prompt": (
            "Explain the tradeoffs between optimistic and pessimistic locking in a Postgres "
            "database under high write concurrency."
        ),
        "outcome_type": "pr_reviewed",
        "outcome_value": 120,
    },
    {
        "prompt": (
            "Generate a comprehensive pytest suite for a function that validates and parses "
            "JWT tokens, covering happy path and all failure modes."
        ),
        "outcome_type": "tests_generated",
        "outcome_value": 150,
    },
]


def run_seed_session(client: Anthropic, prompt: str, outcome_type: str, outcome_value: float) -> None:
    session_id = str(uuid.uuid4())
    sdk.start(session_id)
    sdk.set_prompt(session_id, prompt)

    context = ""
    approach = ""
    total_cost = 0.0

    for i, step in enumerate(VERBOSE_CHAIN_STEPS):
        if step["label"] == "Retrieval":
            user_content = f"User prompt: {prompt}"
        elif step["label"] == "Reasoning":
            user_content = f"User prompt: {prompt}\n\nRetrieved context:\n{context}"
        else:
            user_content = (
                f"User prompt: {prompt}\n\nRetrieved context:\n{context}\n\n"
                f"Structured approach:\n{approach}"
            )

        start_time = time.monotonic()
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=step["system"],
            messages=[{"role": "user", "content": user_content}],
        )
        latency_ms = int((time.monotonic() - start_time) * 1000)

        output_text = next((b.text for b in response.content if b.type == "text"), "")
        if step["label"] == "Retrieval":
            context = output_text
        elif step["label"] == "Reasoning":
            approach = output_text

        token_cost = sdk.log_call(
            session_id=session_id,
            call_label=step["label"],
            call_order=i,
            model=MODEL,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            latency_ms=latency_ms,
            output_text=output_text,
        )
        total_cost += token_cost
        print(
            f"  {step['label']:<10} {response.usage.input_tokens + response.usage.output_tokens:>6} tok  "
            f"${token_cost:.5f}  {latency_ms}ms"
        )

    sdk.tag_outcome(session_id, outcome_type, outcome_value)
    print(f"  -> tagged {outcome_type} (${outcome_value}), total cost ${total_cost:.5f}")
    print(f"  -> session_id {session_id}\n")


def main():
    init_db()
    client = Anthropic()

    print(f"Seeding {len(SEED_SESSIONS)} verbose demo sessions...\n")
    for seed in SEED_SESSIONS:
        print(f"Prompt: {seed['prompt'][:80]}...")
        run_seed_session(client, seed["prompt"], seed["outcome_type"], seed["outcome_value"])

    print("Done.")


if __name__ == "__main__":
    main()
