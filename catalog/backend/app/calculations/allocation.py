"""Portfolio allocation helpers."""

from .constants import ALLOCATIONS, FUND_META


def compute_allocation(
    risk: str,
    ccy: str,
    manual: bool = False,
    manual_funds: dict[str, float] | None = None,
) -> dict[str, float]:
    """Return fund_key → weight (sum ≈ 100)."""
    if manual:
        return dict(manual_funds or {})
    if risk == "base":
        return dict(ALLOCATIONS["base"])
    return dict(ALLOCATIONS[risk][ccy])


def compute_index_weights(fund_weights: dict[str, float]) -> dict[str, float]:
    """Aggregate benchmark weights proportionally to fund weights."""
    total = sum(fund_weights.values())
    idx_w: dict[str, float] = {}
    if total > 0:
        for key, w in fund_weights.items():
            if w > 0:
                benchmark = FUND_META[key]["benchmark"]
                idx_w[benchmark] = idx_w.get(benchmark, 0.0) + w
    return idx_w


def get_currency_breakdown(weights: dict[str, float]) -> dict[str, float]:
    """Sum weights by native currency: RUB | USD | CNY | GLD."""
    out: dict[str, float] = {"RUB": 0.0, "USD": 0.0, "CNY": 0.0, "GLD": 0.0}
    for key, w in weights.items():
        ccy = FUND_META[key]["native_currency"]
        out[ccy] = out.get(ccy, 0.0) + w
    return out
