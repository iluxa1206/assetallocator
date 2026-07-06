"""Portfolio allocation helpers."""

from .constants import ALLOCATIONS, CCY_STRATEGIES, FUND_META


def tilt_for_external(
    weights: dict[str, float],
    our_base: float,
    ext_rub_base: float,
    ext_fx_base: float,
    ccy_strategy: str,
) -> tuple[dict[str, float], bool]:
    """Tilt our fund weights so the COMBINED portfolio (our funds + client's external
    assets) hits the strategy's RUB/FX target. Our funds fill the gap left by external
    holdings. RUB bucket = RUB-denominated funds; FX bucket = USD/CNY/GLD funds.

    Returns (new_weights, adjusted). `adjusted` is False when nothing changed.
    """
    strat = CCY_STRATEGIES.get(ccy_strategy)
    if not strat or our_base <= 0:
        return weights, False

    whole = our_base + ext_rub_base + ext_fx_base
    if whole <= 0:
        return weights, False

    target_fx_frac = strat["val"] / 100.0
    target_fx_val = target_fx_frac * whole
    our_fx_val = max(0.0, min(target_fx_val - ext_fx_base, our_base))
    our_fx_frac = our_fx_val / our_base
    our_rub_frac = 1.0 - our_fx_frac

    rub_sum = sum(w for k, w in weights.items() if w > 0 and FUND_META[k]["native_currency"] == "RUB")
    fx_sum = sum(w for k, w in weights.items() if w > 0 and FUND_META[k]["native_currency"] != "RUB")

    out: dict[str, float] = {}
    for k, w in weights.items():
        if w <= 0:
            out[k] = 0.0
            continue
        is_rub = FUND_META[k]["native_currency"] == "RUB"
        if is_rub:
            out[k] = (w / rub_sum) * our_rub_frac * 100.0 if rub_sum > 0 else 0.0
        else:
            out[k] = (w / fx_sum) * our_fx_frac * 100.0 if fx_sum > 0 else 0.0

    total = sum(out.values())
    if total <= 0:
        return weights, False
    out = {k: v / total * 100.0 for k, v in out.items()}

    adjusted = any(abs(out[k] - weights[k]) > 0.05 for k in weights)
    return out, adjusted


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
