# Tracer

A proof-of-concept demonstrating token-level attribution for LLM workflows: connect a chain of LLM API calls to a tagged business outcome, then distribute credit across the chain using selectable attribution models.

## Stack

- **Backend:** Flask + the Anthropic Python SDK, SQLite for session/trace persistence
- **Frontend:** React + Vite

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Add your Anthropic API key to `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Run the server:

```bash
python app.py
```

Flask runs on `http://localhost:5000`. The SQLite database (`tracer.db`) is created automatically on first run.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` requests to the Flask backend.

## Usage

1. Open `http://localhost:5173`.
2. Enter a prompt and click **Run Tracer** — this fires three real Claude API calls (Retrieval → Reasoning → Generation), each logged through `tracer/sdk.py`.
3. Tag a business outcome against the resulting session.
4. Toggle between attribution models (Last Call, Even Split, Recency Weighted) and watch credit redistribute across the chain.

## Architecture

- `backend/tracer/sdk.py` — the instrumentation primitives: `trace.start()`, `trace.log_call()`, `trace.tag_outcome()`
- `backend/tracer/attribution.py` — the three attribution models
- `backend/tracer/db.py` — SQLite schema and connection handling
- `backend/app.py` — Flask routes and the three-step LLM chain
