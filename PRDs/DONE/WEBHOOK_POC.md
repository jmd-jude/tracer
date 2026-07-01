# Tracer — GitHub Webhook POC Build Spec

This extends the existing Tracer POC to close the attribution loop automatically using real GitHub webhook events. The goal: a developer runs an LLM chain through Tracer, opens a PR, and when that PR merges, Tracer receives the GitHub webhook, matches it to the session, and tags the outcome — no manual outcome tagging required.

This is a proof of concept, not production. Use your existing GitHub account and a real repo (can be a throwaway test repo).

> **Post-build correction:** this spec originally said to add `.tracer` to `.gitignore`. That's wrong — the GitHub Action reads `.tracer` from a checkout of the *pushed* branch, so a gitignored file (which never gets pushed) is invisible to it. The implementation was corrected to track `.tracer` in git so it travels with the branch on a normal `git add`/`commit`/`push`, which is what makes Part 4 (automatic propagation) actually work.

---

## What we're building

Three clean GitHub webhook intercepts:

- **PR merged** → `pull_request` event, `action: closed`, `merged: true` → outcome: `pr_reviewed` ($120)
- **Bug resolved** → `issues` event, `action: closed` + label `bug` → outcome: `bug_resolved` ($200)
- **Code review completed** → `pull_request_review` event, `action: submitted`, `state: approved` → outcome: `codegen_accepted` ($85)

Session ID propagation happens two ways — manual first (to prove the concept), then automatic via GitHub Action (to make it feel like a pixel).

---

## Architecture

```
SDK writes session_id to .tracer file in repo root
    ↓
Developer opens PR (manual phase: pastes tracer-session: <id> in PR description)
    ↓
GitHub fires webhook to Tracer backend
    ↓
Flask webhook handler parses session_id from PR description
    ↓
Tracer auto-tags the outcome against that session
    ↓
Attribution output updates automatically in the UI
```

---

## Part 1 — Webhook receiver (Flask)

Add a new route to `backend/app.py`:

```
POST /api/webhook/github
```

This endpoint:

1. Receives the GitHub webhook POST
2. Reads the `X-GitHub-Event` header to determine event type
3. Parses the payload for the relevant fields
4. Extracts the session ID from the PR description or issue body using a simple pattern match: `tracer-session: <uuid>`
5. Looks up the session in the DB — if found and not yet tagged, auto-tags the appropriate outcome
6. Returns 200

Event routing logic:

```python
if event == "pull_request" and payload["action"] == "closed" and payload["pull_request"]["merged"]:
    outcome_type = "pr_reviewed"  # $120

elif event == "pull_request_review" and payload["action"] == "submitted" and payload["review"]["state"] == "approved":
    outcome_type = "codegen_accepted"  # $85

elif event == "issues" and payload["action"] == "closed":
    labels = [l["name"] for l in payload["issue"]["labels"]]
    if "bug" in labels:
        outcome_type = "bug_resolved"  # $200
```

Add a simple idempotency check — if the session already has an outcome tagged, skip and return 200. Don't overwrite.

Add a new DB table `webhook_events` to log every inbound event: `event_type`, `github_payload` (JSON), `session_id_extracted`, `outcome_tagged`, `received_at`. This is useful for debugging during the demo and also makes the system feel real.

---

## Part 2 — ngrok tunnel for local development

The webhook needs a public URL. Use ngrok:

```bash
ngrok http 5050
```

Copy the `https://xxxx.ngrok.io` URL. In your GitHub repo settings → Webhooks → Add webhook:

- Payload URL: `https://xxxx.ngrok.io/api/webhook/github`
- Content type: `application/json`
- Events: select **Pull requests**, **Pull request reviews**, **Issues**

Add a `GITHUB_WEBHOOK_SECRET` to `backend/.env` (set it in GitHub webhook settings too) and verify the `X-Hub-Signature-256` header on every inbound request. One function, ~10 lines. Don't skip this — it's what makes the endpoint not open to anyone.

---

## Part 3 — Manual session ID injection (prove the concept)

Convention: the developer includes this line anywhere in the PR description or issue body:

```
tracer-session: 124b1ede-855c-444b-997e-c86dd5711fe9
```

Use a simple regex to extract it:

```python
import re
match = re.search(r'tracer-session:\s*([a-f0-9-]{36})', body or "")
session_id = match.group(1) if match else None
```

This is enough to prove the end-to-end loop. Run a Tracer session, copy the session ID from the UI, open a PR in your test repo with that line in the description, merge it, and watch the outcome appear in Tracer automatically.

---

## Part 4 — Automatic session ID propagation via GitHub Action

Once Part 3 is verified working, add a GitHub Action to the test repo that eliminates the manual step.

Create `.github/workflows/tracer-tag.yml` in the test repo:

```yaml
name: Tracer Session Tag

on:
  pull_request:
    types: [opened, edited]

jobs:
  tag-session:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Read Tracer session ID
        id: read_session
        run: |
          if [ -f .tracer ]; then
            SESSION_ID=$(cat .tracer)
            echo "session_id=$SESSION_ID" >> $GITHUB_OUTPUT
          fi

      - name: Append session ID to PR description
        if: steps.read_session.outputs.session_id != ''
        uses: actions/github-script@v7
        with:
          script: |
            const sessionId = '${{ steps.read_session.outputs.session_id }}';
            const body = context.payload.pull_request.body || '';
            if (!body.includes('tracer-session:')) {
              await github.rest.pulls.update({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                body: body + '\n\ntracer-session: ' + sessionId
              });
            }
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The SDK's `trace.start()` function should write the session ID to `.tracer` in the current working directory when a chain starts. Add that one line to `backend/tracer/sdk.py`. Add `.tracer` to `.gitignore`.

With this in place: developer runs a Tracer chain → `.tracer` file written → developer opens a PR → Action reads `.tracer`, appends session ID to PR description automatically → PR merges → webhook fires → Tracer tags the outcome. Zero manual steps.

---

## Part 5 — UI updates

Two small additions to the frontend:

**1. Webhook event log panel**

Below the Recent Sessions table, add a "Webhook Events" section. Simple table: timestamp, event type, session ID (monospace, 8 chars), outcome tagged, status (green badge "auto-tagged" or slate badge "no session match"). Query a new `GET /api/webhook/events` route returning the last 20 rows from `webhook_events`. 

This panel is a demo asset — watching a real GitHub event arrive and auto-tag an outcome in real time is the moment that makes the concept land.

**2. Session history — source indicator**

In the Recent Sessions table, add a small badge on each row indicating how the outcome was tagged: "manual" (slate) or "auto" (green, with a small GitHub-ish icon or just the word). This makes the distinction between the old flow and the new flow immediately visible.

---

## Demo flow once complete

1. Run a Tracer chain in the UI on a real prompt
2. `.tracer` file written automatically by the SDK
3. Open a PR in the test repo — Action appends session ID to description
4. Merge the PR (or approve a review, or close a bug issue)
5. GitHub fires the webhook
6. Tracer receives it, auto-tags `pr_reviewed` at $120
7. Webhook Events panel shows the inbound event in real time
8. Recent Sessions table shows the session with a green "auto" badge and the ROI multiple

That's the pixel moment. Show it live.

---

## Files touched

- `backend/app.py` — add `/api/webhook/github` and `/api/webhook/events` routes
- `backend/tracer/sdk.py` — add `.tracer` file write to `trace.start()`
- `backend/tracer/db.py` — add `webhook_events` table
- `backend/.env` — add `GITHUB_WEBHOOK_SECRET`
- `frontend/src/App.jsx` (or equivalent) — webhook events panel, source badge
- Test repo: `.github/workflows/tracer-tag.yml`
- Test repo: `.gitignore` — add `.tracer`

---

## What done looks like

A real GitHub event (PR merge, review approval, or issue close with bug label) automatically triggers outcome attribution in Tracer with no manual tagging. The session ID propagates from the SDK through the filesystem and into the PR description without the developer touching it. The UI shows the inbound webhook event and the auto-tagged outcome in real time.

This is the proof that the outcome side of attribution can be as low-friction as the cost side.