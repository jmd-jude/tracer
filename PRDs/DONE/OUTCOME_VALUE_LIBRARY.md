# Tracer — Outcome Value Library Spec

Move outcome types and dollar values from hardcoded Python (`app.py`) into a DB-backed table with a simple CRUD UI. The goal: any user can define their own outcome types, set values, and map them to webhook events without touching code.

---

## What changes

Right now `OUTCOMES` is a dict in `app.py`:

```python
OUTCOMES = {
    "pr_reviewed": {"label": "PR reviewed and merged", "value": 120},
    ...
}
```

After this build, `OUTCOMES` is a DB table. The hardcoded dict goes away. All routes that reference it (`/api/outcome/tag`, `/api/webhook/github`, `/api/outcomes`) read from the DB instead.

---

## DB changes

New table in `backend/tracer/db.py`:

```sql
CREATE TABLE IF NOT EXISTS outcome_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outcome_key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    value REAL NOT NULL,
    webhook_event TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

`outcome_key` — the internal identifier (e.g. `pr_reviewed`). Used in existing session/webhook logic, so must stay stable once created.

`webhook_event` — optional, maps this outcome to a GitHub webhook event type for the auto-tagging logic. Values like `pull_request:merged`, `issues:closed:bug`, `pull_request_review:approved`. NULL means manual-only outcome.

Seed the table on `init_db()` with the current six hardcoded outcomes so existing sessions and webhook mappings aren't broken.

---

## Backend changes

New SDK functions in `backend/tracer/sdk.py`:

```python
def list_outcome_types() -> list[dict]
def get_outcome_type(outcome_key: str) -> dict | None
def create_outcome_type(outcome_key, label, value, webhook_event=None) -> dict
def update_outcome_type(outcome_key, label, value, webhook_event=None) -> dict
def delete_outcome_type(outcome_key: str) -> None
```

New routes in `backend/app.py`:

```
GET    /api/outcome-types          — list all
POST   /api/outcome-types          — create new
PUT    /api/outcome-types/<key>    — update label/value/webhook_event
DELETE /api/outcome-types/<key>    — delete (block if key is referenced by any session)
```

Update existing routes to read from DB instead of the hardcoded dict:
- `/api/outcomes` — already a list route, now reads from `outcome_types` table
- `/api/outcome/tag` — validate `outcome_type` against DB, not dict
- `/api/webhook/github` — webhook event → outcome mapping reads from `webhook_event` column, not hardcoded `if/elif` block

The webhook routing logic in `/api/webhook/github` should be refactored to query: "find the outcome_type where webhook_event matches this inbound event pattern." This makes adding a new webhook-mapped outcome a UI action, not a code change.

---

## Frontend changes

New component: `frontend/src/components/OutcomeLibrary.jsx`

Mounted below the Webhook Events panel in `App.jsx` as a full-width section.

**List view** — table with columns: Key (mono), Label, Value ($), Webhook Event (slate, or "manual only" if null), Actions (Edit / Delete).

**Add/Edit form** — inline form below the table, not a modal. Fields:

- Outcome key (text, slug-style, lowercase, no spaces — validate on input)
- Label (text)
- Value ($, number)
- Webhook event mapping (select or text — see note below)

**Delete behavior** — if the outcome key appears in any session, show an inline error: "This outcome has been used in X sessions and cannot be deleted." No destructive deletes that would orphan session data.

**Webhook event field** — for now a simple text input with a helper note listing the supported patterns:
- `pull_request:merged`
- `pull_request_review:approved`
- `issues:closed:bug`

Leave as text for the POC — a dropdown can come later when the integration surface is wider.

---

## What this unlocks

- Any customer can define outcomes relevant to their workflow without a code change
- Webhook auto-tagging is configurable via UI — adding a new GitHub event mapping is a form submission, not a deploy
- Sets up the pattern for the HubSpot/Jira/Zendesk integration lane — each new connector just adds new valid `webhook_event` patterns to the mapping field

---

## What done looks like

1. Hardcoded `OUTCOMES` dict removed from `app.py`
2. Six default outcomes seeded in DB on first run — existing sessions and webhook behavior unchanged
3. Outcome Library panel renders in the UI with all six defaults listed
4. User can add a new outcome type, set a value, optionally map it to a webhook event, and it immediately appears in the Tag Outcome panel and is active for webhook matching
5. Deleting an outcome with existing sessions is blocked with a clear error