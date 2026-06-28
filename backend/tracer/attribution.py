"""Attribution models for distributing a tagged outcome's value across a call chain."""

# Credit weights for a recency-weighted split, indexed by call_order, for a
# three-step chain (retrieval, reasoning, generation).
RECENCY_WEIGHTS_3 = [0.20, 0.30, 0.50]


def last_call(calls: list[dict], outcome_value: float) -> list[dict]:
    """100% credit to the final call in the chain."""
    n = len(calls)
    results = []
    for i, call in enumerate(calls):
        pct = 1.0 if i == n - 1 else 0.0
        results.append(_credit(call, pct, outcome_value))
    return results


def even_split(calls: list[dict], outcome_value: float) -> list[dict]:
    """Credit divided equally across all calls."""
    n = len(calls)
    pct = 1.0 / n if n else 0.0
    return [_credit(call, pct, outcome_value) for call in calls]


def recency_weighted(calls: list[dict], outcome_value: float) -> list[dict]:
    """Credit distributed on a decay curve weighted toward the end of the chain."""
    n = len(calls)
    if n == len(RECENCY_WEIGHTS_3):
        weights = RECENCY_WEIGHTS_3
    else:
        # General decay curve for chains of other lengths: linearly increasing weights, normalized.
        raw = [i + 1 for i in range(n)]
        total = sum(raw)
        weights = [w / total for w in raw] if total else [0.0] * n
    return [_credit(call, weights[i], outcome_value) for i, call in enumerate(calls)]


def _credit(call: dict, pct: float, outcome_value: float) -> dict:
    return {
        "call_label": call["call_label"],
        "call_order": call["call_order"],
        "model": call["model"],
        "token_cost": call["token_cost"],
        "credit_pct": pct,
        "credited_value": pct * outcome_value,
    }


MODELS = {
    "last_call": last_call,
    "even_split": even_split,
    "recency_weighted": recency_weighted,
}


def compute_all_models(calls: list[dict], outcome_value: float) -> dict:
    """Run every attribution model and return results keyed by model name."""
    return {name: fn(calls, outcome_value) for name, fn in MODELS.items()}
