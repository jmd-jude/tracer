# Tracer: Token Attribution for LLM Workflows
### Strategic Vision Memo — June 2026

---

## The Problem

Companies are spending real money on LLM API tokens and the people holding the budget cannot cleanly answer what that spend actually produced.

This is not a new problem.

---

## We have been here before

When digital advertising became measurable, the first instinct was to count clicks. Clicks were available, clicks were concrete, and clicks were obviously inadequate — but they were something, and "something" beats "nothing" when a VP is asking questions.

Then someone pointed out that the last click before a conversion was getting all the credit for work that started several touchpoints earlier. That insight launched an entire discipline: marketing attribution. Last-click gave way to first-touch, then to multi-touch weighted models, then to incrementality testing. The methodology matured over fifteen years under sustained budget pressure.

LLM spend is now at the click-counting stage.

Engineering and AI platform teams are logging token cost per call. That is the equivalent of counting clicks. It measures activity, not value. Everyone with a budget to defend knows it is inadequate, and everyone is using it anyway because nothing better exists.

Tracer is the next rung on that ladder.

---

## What attribution actually means here

A business outcome — a support ticket resolved, a bug triaged, a PR reviewed, a churn risk flagged — is rarely the product of a single LLM call. It is the product of a chain: a retrieval step that surfaces context, a reasoning step that structures a response, a generation step that produces the output. In production systems, that chain might be 8-20 calls deep, involving sub-agents, re-ranking, reflection loops, and tool use.

The observability tools (Langfuse, Helicone, Arize, LangSmith) are good at logging each call in isolation: cost, latency, token count, basic evals. What they do not do is group a chain of calls into a session, tag a business outcome against that session, and distribute credit back across the chain.

That connective tissue is the gap Tracer fills.

The mechanism has three primitives:

`trace.start(session_id)` — opens an attribution window

`trace.log_call(session_id, label, cost, model)` — records each LLM call in the chain

`trace.tag_outcome(session_id, outcome_type, value)` — closes the loop with a business result

Once those three pieces are in place, attribution is a methodology question — the same question marketing attribution has been answering for years. Last call (all credit to generation). Even split (credit divided equally). Recency weighted (a decay curve toward the end of the chain). The model you choose is a business decision, not a math decision. Tracer makes it a decision you can actually have.

---

## Why now, why this background

The people building LLM observability tools are infrastructure engineers. Their mental model is reliability, latency, and cost-per-call. The question they are instrumenting for is: is my system working.

The question Tracer is instrumenting for is: is my system worth it.

Those require different primitives and different methodology. The attribution discipline — multi-touch credit distribution, incrementality framing, outcome tagging — comes from performance marketing, not from infrastructure engineering. That background is uncommon in AI tooling right now. It is the angle.

---

## Who feels this pain first

Not the CFO. The CFO is the budget-releaser, not the first buyer.

The first buyer is an AI platform lead or product analytics lead at a company that has moved past "experimenting with AI" and now has real LLM infrastructure in production. They are already instrumented at the observability layer. They are now getting asked by finance or their VP to show ROI. They do not have a methodology for answering that question, and they would recognize a purpose-built attribution layer immediately — because most of them have lived through the marketing attribution wars and will see exactly what is happening.

Target profile: 200-2000 person software company, AI/ML platform team or product analytics function, already paying for Langfuse or similar, starting to get hard questions about AI spend from leadership.

---

## What Tracer is not

Tracer is not an observability tool. The observability layer is crowded and well-funded. Tracer sits above it, consuming cost data from whatever observability tool the customer already has.

Tracer is not a FinOps tool. FinOps is about cost reduction. Tracer is about value demonstration. Those are different conversations with different buyers.

Tracer is not a consulting engagement. The instrumentation primitive (the SDK) is designed to be self-serve. A developer installs it in an afternoon. The attribution output is designed to be brought directly into a budget conversation without interpretation.

---

## The current state

Tracer exists as a working proof-of-concept: a three-step LLM chain running against the Anthropic API, instrumented through the SDK primitives, with a full attribution output across three models (Last Call, Even Split, Recency Weighted), session history, and an implied ROI multiple per session.

The POC demonstrates the mechanism correctly. It is not a production system. The next step is validation: finding 5-10 AI platform leads or engineering directors and asking where they are stuck on the ROI conversation internally. Not "would you buy this" — that question produces garbage signal. "When your leadership asks about AI spend ROI, what is the thing you do not have."

If the answer is a methodology for connecting call chains to outcomes, the category is real and Tracer is early.

---

*Tracer is pre-product, pre-revenue. This memo is a thinking document, not a pitch.*