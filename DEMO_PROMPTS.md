# Tracer Demo Prompts

Use these to populate the session history and rehearse the demo. Each entry suggests a prompt and the outcome to tag. Run them in order — the session history table will tell a coherent story about a real engineering team's AI spend.

---

## Run these before the demo

### Session 1 — Code generation, mid-value outcome
**Prompt:** Explain how to implement exponential backoff for retrying failed API calls in Python, with a working code example.
**Tag:** Code generation accepted · $85
**Why:** Clean three-step chain, generation step does the heavy lifting. Last Call vs Recency Weighted contrast is sharp.

### Session 2 — Debugging, high-value outcome
**Prompt:** My React useEffect hook is firing twice in development mode even though my dependency array looks correct. What's causing it and how do I fix it?
**Tag:** Bug triaged and resolved · $200
**Why:** High outcome value against low token cost produces a dramatic ROI multiple. Good for showing the cost vs. credited value summary.

### Session 3 — Documentation, low-value outcome
**Prompt:** Write a concise README section explaining what rate limiting is and why it matters for a public API, for a developer audience.
**Tag:** Documentation drafted · $60
**Why:** Matches the first run from your initial test. Familiar territory, reasoning step earns its keep here.

### Session 4 — PR review, mid-value outcome
**Prompt:** Review this approach: we're storing user session tokens in localStorage instead of httpOnly cookies. What are the security implications and what would you recommend instead?
**Tag:** PR reviewed and merged · $120
**Why:** Retrieval step surfaces security context, reasoning step does real work. Even Split model tells an interesting story here — retrieval deserves credit.

### Session 5 — Test generation, mid-value outcome
**Prompt:** Given a Python function that parses a CSV and returns a list of dicts, what test cases should I write to cover edge cases? Give me the actual pytest code.
**Tag:** Test suite generated · $150
**Why:** All three steps earn credit plausibly. Good for showing Recency Weighted vs Even Split debate — a tester would argue retrieval and reasoning matter as much as generation here.

---

## For live demo during the meeting

**Prompt:** How should I structure error handling in a Node.js Express API that calls three downstream services, where partial failures should still return a degraded response?

Tag live with **Bug triaged and resolved · $200** — it's the highest-value outcome and the implied ROI multiple will land the room.

---

## Toggle talking points

When you switch attribution models during the demo, say something like:

> "This is the same debate we had in marketing attribution for fifteen years. Last-click was easy and wrong. Even split felt fair but ignored how the chain actually worked. The model you choose is a business decision, not a math decision — and right now nobody in AI spend is even having the conversation."