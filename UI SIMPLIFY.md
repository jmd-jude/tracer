# Tracer — UI Simplification PRD

## What we're changing and why

The current UI leads with mechanism. Three columns, an attribution toggle, credit percentages distributed across chain steps. This is the right UI for a technical audience that already believes in the concept and wants to inspect the machinery.

It's the wrong UI for the conversation we need to have first: convincing someone the concept matters at all.

Tracer is not an attribution modeling tool. It's a receipt printer for AI spend with a dollar value attached to each receipt. The UI should reflect that. The number comes first. Everything else is detail that supports the number.

---

## What changes

### 1. Session view — lead with the ROI number

The attribution output panel gets restructured around a single hero metric.

**Current:** Three rows (Retrieval, Reasoning, Generation) each showing credit percentage, token cost, and credited value. Toggle between three attribution models at the top.

**New:** One number, large, centered, immediately visible after outcome tagging:

```
2,966x
implied ROI

$0.04 token cost  →  $120.00 outcome value
```

Below that, a single line in slate: "Based on even-split attribution across 3 calls." No toggle visible by default. Attribution methodology is a footnote, not a feature.

### 2. Chain log — receipt, not breakdown

The call log in the left panel stays but is reframed visually.

**Current:** Retrieval / Reasoning / Generation with token counts, latency, and "View output" — reads as a technical debug view.

**New:** Same data, reframed as a cost receipt. "This outcome was produced by 3 LLM calls totaling $0.04." Each row shows call label, cost, and latency. View output toggle stays — it's useful for credibility, just not the lead.

The receipt framing makes the chain log feel like supporting evidence for the ROI number, not the primary artifact.

### 3. Outcome tagging — surface the auto-tag story

When an outcome is auto-tagged via webhook, the middle panel should make that visible and feel significant — not just a green "auto" badge in the history table.

**New:** After auto-tag, the middle panel shows:

```
✓ Outcome auto-tagged

PR reviewed and merged · $120
via GitHub webhook · 12:34:51 PM

Session: d0ea830f
```

This is the moment that demonstrates the pixel analogy. It should feel like something happened automatically, not like a form was submitted.

### 4. Attribution toggle — hide, don't remove

Last Call and Recency Weighted options are hidden from the UI. Even Split remains as the single default model, labeled simply as "how credit is calculated" if labeled at all.

The toggle code stays intact. It surfaces in a future "advanced" or "methodology" view for technical buyer conversations. It does not appear in the default session view.

### 5. Session history — ROI column is the star

The Recent Sessions table already shows the ROI multiple in blue. That column should be the visual anchor — larger text, or at minimum the most prominent column. Prompt snippet and outcome type are context. The ROI number is the point.

Source badge (manual / auto) stays — it's doing real work demonstrating the automatic loop.

---

## What doesn't change

- The three-step chain still runs and logs real API calls
- Token costs are still calculated and displayed
- Session IDs are still visible in monospace
- The SDK snippet panel stays
- The Outcome Library stays
- The Webhook Events panel stays
- All underlying attribution math stays in the code

---

## Layout sketch

```
┌─────────────────────────────────────────────────────────────────┐
│  RUN A CHAIN                                                     │
│  [prompt input]                    [Run Tracer]                  │
│                                                                  │
│  ● Retrieval    402 tok · 8028ms                                 │
│  ● Reasoning   1420 tok · 19233ms                                │
│  ● Generation  2438 tok · 14024ms                                │
│                                                                  │
│  Receipt: 3 calls · $0.04 total    [View outputs ▾]             │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────────────┐
│  TAG OUTCOME             │  │  ATTRIBUTION OUTPUT              │
│                          │  │                                  │
│  [outcome picker]        │  │         2,966x                   │
│                          │  │      implied ROI                 │
│  ✓ PR reviewed · $120   │  │                                  │
│  via GitHub · auto       │  │  $0.04 cost → $120.00 value     │
│  Session: d0ea830f       │  │                                  │
│                          │  │  even-split across 3 calls       │
│  [SDK snippet ▾]         │  │                                  │
└──────────────────────────┘  └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  RECENT SESSIONS                                                 │
│  SESSION   PROMPT              OUTCOME          ROI      SOURCE │
│  d0ea830f  My React useEffe…   PR reviewed    2966x      auto  │
│  e68f28b6  Explain exponenti…  Code gen acc   2066x      manual│
└─────────────────────────────────────────────────────────────────┘
```

---

## The test

Show this to someone who has never seen Tracer. Within 30 seconds they should be able to answer:

- What did this AI workflow cost? ($0.04)
- What did it produce? (A merged PR, valued at $120)
- Was it worth it? (2,966x says yes)

If they can answer those three questions without asking what the attribution toggle does, the UI is working.

---

## What this is not

This is not a rebuild. It's a hierarchy and emphasis change. The data model, the backend, the attribution engine, and the connector architecture are untouched. This is purely about what the UI leads with and what it treats as supporting detail.