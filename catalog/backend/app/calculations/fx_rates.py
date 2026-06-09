"""FX conversion utilities."""

from .types import MarketRow


def fx_rate(from_ccy: str, to_ccy: str, row: MarketRow) -> float | None:
    """Return exchange rate from_ccy → to_ccy using RUB as bridge."""
    if from_ccy == to_ccy:
        return 1.0

    def rub_per(c: str) -> float | None:
        if c == "RUB":
            return 1.0
        if c == "USD":
            return row.get("usdrub")
        if c == "CNY":
            return row.get("cnyrub")
        if c == "GLD":
            return row.get("gldrub")
        return None

    r_from = rub_per(from_ccy)
    r_to = rub_per(to_ccy)
    if r_from is None or r_to is None or r_to == 0:
        return None
    return r_from / r_to


def rub_to_base_rate(row: MarketRow, base: str) -> float | None:
    """Return rate to convert 1 RUB → base currency (inverse of RUB-per-base)."""
    if base == "RUB":
        return 1.0
    rub_per_base: float | None = {
        "USD": row.get("usdrub"),
        "CNY": row.get("cnyrub"),
        "GLD": row.get("gldrub"),
    }.get(base)
    if not rub_per_base:
        return None
    return 1.0 / rub_per_base


def fund_price_in_currency(
    price_rub: float,
    to_ccy: str,
    row: MarketRow,
) -> float | None:
    """Convert fund price (in RUB) to target currency."""
    if to_ccy == "RUB":
        return price_rub
    rate = fx_rate("RUB", to_ccy, row)
    if rate is None:
        return None
    return price_rub * rate
