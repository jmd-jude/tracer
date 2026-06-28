# Tracer

Token-level attribution demo for LLM workflows. Vision-demo POC, not production: credibility comes from the mechanism working correctly and the UI feeling like real infra tooling.

## Stack

- Backend: Flask + Anthropic Python SDK + SQLite (`backend/tracer.db`, gitignored, recreated on first run)
- Frontend: React + Vite, plain CSS with custom properties (no Tailwind) — tokens live in `frontend/src/index.css`, mirror the vault_md design spec exactly

## Running it

```bash
cd backend && .venv/bin/python app.py   # :5000
cd frontend && npm run dev               # :5173, proxies /api to backend
```

## Known quirks

- **Port 5000 + macOS AirPlay Receiver:** Control Center listens on `localhost:5000` over IPv6 (AirTunes). The Vite proxy in `vite.config.js` points at `127.0.0.1:5000` explicitly to avoid silently hitting Control Center instead of Flask. If you ever curl-test the backend directly, use `127.0.0.1`, not `localhost`.
- API key lives in `backend/.env` (gitignored). Never commit it.

## Architecture

- `backend/tracer/sdk.py` — the three instrumentation primitives (`start`, `log_call`, `tag_outcome`). These are the thing being demonstrated, not scaffolding — keep them readable as a reference implementation.
- `backend/tracer/attribution.py` — Last Call / Even Split / Recency Weighted (20/30/50, hardcoded for the 3-step chain) models.
- `backend/app.py` — Flask routes + the three-call chain (Retrieval → Reasoning → Generation), all real `claude-sonnet-4-6` calls.
- Outcome menu (types + dollar values) and the recency-weight curve are intentionally fixed per the original spec — not meant to be made configurable for this POC.
