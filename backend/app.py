import hashlib
import hmac
import os
import re
import time
import uuid

from anthropic import Anthropic
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from tracer import attribution, sdk
from tracer.db import init_db

load_dotenv()

SESSION_ID_RE = re.compile(r"tracer-session:\s*([a-f0-9-]{36})")
OUTCOME_KEY_RE = re.compile(r"^[a-z0-9]+(_[a-z0-9]+)*$")

app = Flask(__name__)
CORS(app)
client = Anthropic()

MODEL = "claude-sonnet-4-6"

CHAIN_STEPS = [
    {
        "label": "Retrieval",
        "system": (
            "You are a retrieval system. Given a user prompt, surface the most relevant "
            "background context a downstream reasoning step would need. Be concise — "
            "3-5 markdown dash-bullet points ('- ...') of concrete context, no preamble."
        ),
    },
    {
        "label": "Reasoning",
        "system": (
            "You are a reasoning system. Given a user prompt and retrieved context, "
            "analyze the problem and structure a response approach. Be concise — "
            "outline the approach in 3-5 short steps, no preamble."
        ),
    },
    {
        "label": "Generation",
        "system": (
            "You are a generation system. Given a user prompt, retrieved context, and a "
            "structured approach, produce the final user-facing output. Be direct and complete."
        ),
    },
]


init_db()


@app.route("/api/session/start", methods=["POST"])
def start_session():
    session_id = str(uuid.uuid4())
    sdk.start(session_id)
    return jsonify({"session_id": session_id})


@app.route("/api/chain/run", methods=["POST"])
def run_chain():
    data = request.get_json()
    prompt = data["prompt"]
    session_id = data["session_id"]
    sdk.set_prompt(session_id, prompt)

    call_log = []
    context = ""
    approach = ""

    for i, step in enumerate(CHAIN_STEPS):
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
            max_tokens=1024,
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

        call_log.append(
            {
                "call_label": step["label"],
                "call_order": i,
                "model": MODEL,
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
                "token_cost": token_cost,
                "latency_ms": latency_ms,
                "output_text": output_text,
            }
        )

    return jsonify({"session_id": session_id, "calls": call_log})


@app.route("/api/outcome/tag", methods=["POST"])
def tag_outcome():
    data = request.get_json()
    session_id = data["session_id"]
    outcome_type = data["outcome_type"]

    outcome = sdk.get_outcome_type(outcome_type)
    if not outcome:
        return jsonify({"error": "unknown outcome_type"}), 400

    sdk.tag_outcome(session_id, outcome_type, outcome["value"])

    return jsonify(
        {
            "session_id": session_id,
            "outcome_type": outcome_type,
            "outcome_label": outcome["label"],
            "outcome_value": outcome["value"],
        }
    )


@app.route("/api/attribution/<session_id>", methods=["GET"])
def get_attribution(session_id):
    session = sdk.get_session(session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404
    if session["outcome_value"] is None:
        return jsonify({"error": "no outcome tagged for this session"}), 400

    calls = sdk.get_calls(session_id)
    outcome_value = session["outcome_value"]
    results = attribution.compute_all_models(calls, outcome_value)

    total_cost = sum(c["token_cost"] for c in calls)
    roi = outcome_value / total_cost if total_cost else None
    outcome_row = sdk.get_outcome_type(session["outcome_type"])
    outcome_label = outcome_row["label"] if outcome_row else session["outcome_type"]

    return jsonify(
        {
            "session_id": session_id,
            "prompt": session["prompt"],
            "outcome_type": session["outcome_type"],
            "outcome_label": outcome_label,
            "outcome_value": outcome_value,
            "total_cost": total_cost,
            "roi_multiple": roi,
            "models": results,
            "calls": calls,
        }
    )


@app.route("/api/sessions", methods=["GET"])
def list_sessions():
    sessions = sdk.list_recent_sessions(limit=10)
    result = []
    for s in sessions:
        prompt = s["prompt"] or ""
        snippet = prompt[:60] + ("…" if len(prompt) > 60 else "")
        total_cost = s["total_cost"] or 0
        roi = s["outcome_value"] / total_cost if total_cost else None
        outcome_row = sdk.get_outcome_type(s["outcome_type"])
        outcome_label = outcome_row["label"] if outcome_row else s["outcome_type"]
        result.append(
            {
                "session_id": s["session_id"],
                "prompt_snippet": snippet,
                "outcome_type": s["outcome_type"],
                "outcome_label": outcome_label,
                "outcome_value": s["outcome_value"],
                "roi_multiple": roi,
                "created_at": s["created_at"],
                "tagged_via": s["tagged_via"],
            }
        )
    return jsonify(result)


@app.route("/api/outcomes", methods=["GET"])
def list_outcomes():
    return jsonify(
        [
            {"outcome_type": o["outcome_key"], "label": o["label"], "value": o["value"]}
            for o in sdk.list_outcome_types()
        ]
    )


@app.route("/api/outcome-types", methods=["GET"])
def list_outcome_types_route():
    return jsonify(sdk.list_outcome_types())


@app.route("/api/outcome-types", methods=["POST"])
def create_outcome_type_route():
    data = request.get_json()
    outcome_key = data.get("outcome_key", "")
    label = data.get("label", "")
    value = data.get("value")
    webhook_event = data.get("webhook_event") or None

    if not OUTCOME_KEY_RE.match(outcome_key):
        return jsonify({"error": "outcome_key must be lowercase letters, numbers, and underscores"}), 400
    if not label.strip():
        return jsonify({"error": "label is required"}), 400
    if value is None or not isinstance(value, (int, float)) or value < 0:
        return jsonify({"error": "value must be a non-negative number"}), 400
    if sdk.get_outcome_type(outcome_key):
        return jsonify({"error": "outcome_key already exists"}), 400
    if webhook_event and sdk.get_outcome_type_by_webhook_event(webhook_event):
        return jsonify({"error": f"webhook_event '{webhook_event}' is already mapped to another outcome"}), 400

    outcome = sdk.create_outcome_type(outcome_key, label.strip(), value, webhook_event)
    return jsonify(outcome), 201


@app.route("/api/outcome-types/<key>", methods=["PUT"])
def update_outcome_type_route(key):
    if not sdk.get_outcome_type(key):
        return jsonify({"error": "outcome type not found"}), 404

    data = request.get_json()
    label = data.get("label", "")
    value = data.get("value")
    webhook_event = data.get("webhook_event") or None

    if not label.strip():
        return jsonify({"error": "label is required"}), 400
    if value is None or not isinstance(value, (int, float)) or value < 0:
        return jsonify({"error": "value must be a non-negative number"}), 400

    existing_mapping = sdk.get_outcome_type_by_webhook_event(webhook_event) if webhook_event else None
    if existing_mapping and existing_mapping["outcome_key"] != key:
        return jsonify({"error": f"webhook_event '{webhook_event}' is already mapped to another outcome"}), 400

    outcome = sdk.update_outcome_type(key, label.strip(), value, webhook_event)
    return jsonify(outcome)


@app.route("/api/outcome-types/<key>", methods=["DELETE"])
def delete_outcome_type_route(key):
    if not sdk.get_outcome_type(key):
        return jsonify({"error": "outcome type not found"}), 404
    try:
        sdk.delete_outcome_type(key)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"status": "ok"}), 200


def _verify_github_signature(payload_body: bytes, signature_header: str) -> bool:
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    if not secret or not signature_header:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def _extract_session_id(body: str | None) -> str | None:
    match = SESSION_ID_RE.search(body or "")
    return match.group(1) if match else None


def _derive_webhook_pattern(event: str, payload: dict) -> tuple[str | None, str | None]:
    """Derive a webhook_event pattern string and the relevant body text from an inbound event."""
    if event == "pull_request" and payload.get("action") == "closed" and payload["pull_request"].get("merged"):
        return "pull_request:merged", payload["pull_request"].get("body")
    if (
        event == "pull_request_review"
        and payload.get("action") == "submitted"
        and payload["review"].get("state") == "approved"
    ):
        return "pull_request_review:approved", payload["pull_request"].get("body")
    if event == "issues" and payload.get("action") == "closed":
        labels = [l["name"] for l in payload["issue"].get("labels", [])]
        if "bug" in labels:
            return "issues:closed:bug", payload["issue"].get("body")
    return None, None


@app.route("/api/webhook/github", methods=["POST"])
def github_webhook():
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_github_signature(request.get_data(), signature):
        return jsonify({"error": "invalid signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    payload = request.get_json()

    pattern, body = _derive_webhook_pattern(event, payload)
    outcome = sdk.get_outcome_type_by_webhook_event(pattern) if pattern else None

    session_id = _extract_session_id(body) if outcome else None
    outcome_tagged_label = None

    if session_id and outcome:
        session = sdk.get_session(session_id)
        if session and session["outcome_value"] is None:
            sdk.tag_outcome(session_id, outcome["outcome_key"], outcome["value"], via="auto")
            outcome_tagged_label = outcome["outcome_key"]

    sdk.log_webhook_event(event, payload, session_id, outcome_tagged_label)

    return jsonify({"status": "ok"}), 200


@app.route("/api/webhook/events", methods=["GET"])
def list_webhook_events():
    events = sdk.list_webhook_events(limit=20)
    return jsonify(
        [
            {
                "id": e["id"],
                "event_type": e["event_type"],
                "session_id_extracted": e["session_id_extracted"],
                "outcome_tagged": e["outcome_tagged"],
                "received_at": e["received_at"],
            }
            for e in events
        ]
    )


if __name__ == "__main__":
    app.run(debug=True, port=5050)
