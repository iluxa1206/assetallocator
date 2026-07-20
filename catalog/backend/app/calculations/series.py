"""Portfolio and benchmark series builders."""

from .allocation import compute_index_weights
from .constants import FUND_META, INDEX_TO_COL
from .fx_rates import fund_price_in_currency, rub_to_base_rate
from .types import FundPriceMap, MarketMap


def _fund_price_at(
    key: str,
    date_str: str,
    base_currency: str,
    fund_prices: FundPriceMap,
    market: MarketMap,
) -> float | None:
    """Price of one unit on a date, expressed in base_currency.

    When the report is drawn in the fund's own currency and an official native
    price exists, use it verbatim. Converting the RUB price at the market rate
    would answer a different question — the administrator struck NAV at the CBR
    rate of that date, which is not the rate sitting in market_data.
    """
    price = fund_prices.get(key, {}).get(date_str)
    if price is None:
        return None
    if base_currency == FUND_META.get(key, {}).get("native_currency") and price["native"] is not None:
        return price["native"]
    row = market.get(date_str)
    if row is None:
        return None
    rate = rub_to_base_rate(row, base_currency)
    if rate is None:
        return None
    return price["rub"] * rate


def find_valid_dates(
    weights: dict[str, float],
    start_date: str,
    end_date: str,
    all_dates: list[str],
    base_currency: str,
    fund_prices: FundPriceMap,
    market: MarketMap,
) -> list[str]:
    """Filter all_dates to [start_date, end_date] where all active funds have prices."""
    try:
        i_start = all_dates.index(start_date)
        i_end = all_dates.index(end_date)
    except ValueError:
        return []
    if i_start > i_end:
        return []
    active_keys = [k for k, w in weights.items() if w > 0]
    return [
        d
        for d in all_dates[i_start : i_end + 1]
        if all(_fund_price_at(k, d, base_currency, fund_prices, market) is not None for k in active_keys)
    ]


def build_portfolio_series(
    weights: dict[str, float],
    dates: list[str],
    base_currency: str,
    fund_prices: FundPriceMap,
    market: MarketMap,
) -> list[float] | None:
    """Return portfolio series rebased to 100 at dates[0].

    weights can be unnormalized; function normalises internally.
    """
    total = sum(weights.values())
    if total <= 0:
        return None
    norm = {k: v / total for k, v in weights.items() if v > 0}
    if not norm:
        return None

    start_prices: dict[str, float] = {}
    for k in norm:
        p = _fund_price_at(k, dates[0], base_currency, fund_prices, market)
        if p is None or p == 0:
            return None
        start_prices[k] = p

    series: list[float] = []
    for d in dates:
        v = 0.0
        for k, w in norm.items():
            p = _fund_price_at(k, d, base_currency, fund_prices, market)
            if p is None:
                return None
            v += w * (p / start_prices[k])
        series.append(v * 100)
    return series


def build_benchmark_series(
    weights: dict[str, float],
    dates: list[str],
    base_currency: str,
    market: MarketMap,
    manual_index_weights: dict[str, float] | None = None,
) -> list[float] | None:
    """Return composite benchmark series rebased to 100 at dates[0].

    Indices are stored in RUB; converted to base_currency via rubToBaseRate.
    manual_index_weights overrides auto-computed weights (frontend manual mode).

    Index providers report at different speeds — Cbonds lags MOEX/FX by a month or
    two, so the newest market rows carry a fresh RGBITR next to a NULL Cbonds. Those
    gaps are carried forward from the last known value instead of blanking the whole
    series, mirroring the per-source carry-forward on the fund page.
    """
    idx_weights = manual_index_weights if manual_index_weights is not None else compute_index_weights(weights)
    total = sum(idx_weights.values())
    if total <= 0:
        return None
    norm = {k: v / total for k, v in idx_weights.items() if v > 0}

    start_row = market.get(dates[0])
    if start_row is None:
        return None
    start_rate = rub_to_base_rate(start_row, base_currency)
    if start_rate is None:
        return None

    start_vals: dict[str, float] = {}
    for k in norm:
        col = INDEX_TO_COL.get(k, k.lower())
        val = start_row.get(col)  # type: ignore[literal-required]
        if val is None:
            return None
        start_vals[k] = val * start_rate

    last_vals: dict[str, float] = {k: start_vals[k] / start_rate for k in norm}

    series: list[float] = []
    for d in dates:
        row = market.get(d)
        if row is None:
            return None
        rate = rub_to_base_rate(row, base_currency)
        if rate is None:
            return None
        v = 0.0
        for k, w in norm.items():
            col = INDEX_TO_COL.get(k, k.lower())
            val = row.get(col)  # type: ignore[literal-required]
            if val is None:
                val = last_vals[k]  # provider hasn't reported yet — hold the last print
            else:
                last_vals[k] = val
            v += w * (val * rate / start_vals[k])
        series.append(v * 100)
    return series
