"""CPI cumulative level computation (mirrors JS getGlobalCpiLevels)."""

import datetime

from .types import MarketMap


def _find_12m_ago(date_str: str, dates_set: set[str]) -> str | None:
    d = datetime.date.fromisoformat(date_str)
    try:
        direct = d.replace(year=d.year - 1).isoformat()
        if direct in dates_set:
            return direct
    except ValueError:
        pass  # Feb 29 in non-leap year
    # fallback: last day of same month one year ago
    import calendar
    last_day = calendar.monthrange(d.year - 1, d.month)[1]
    eom = datetime.date(d.year - 1, d.month, last_day).isoformat()
    return eom if eom in dates_set else None


def get_global_cpi_levels(col: str, market: MarketMap) -> dict[str, float]:
    """Build cumulative CPI level index (base = 1.0 at first date).

    col: DB column name, e.g. "cpi_rub" | "cpi_usd" | "cpi_cny"
    Returns date_str → level.
    """
    dates = sorted(d for d, row in market.items() if row.get(col) is not None)
    if not dates:
        return {}
    dates_set = set(dates)
    levels: dict[str, float] = {}
    levels[dates[0]] = 1.0
    for i in range(1, len(dates)):
        d = dates[i]
        yoy = market[d][col]  # type: ignore[literal-required]
        p12 = _find_12m_ago(d, dates_set)
        if p12 and p12 in levels:
            levels[d] = levels[p12] * (1 + yoy / 100)
        else:
            levels[d] = levels[dates[i - 1]] * ((1 + yoy / 100) ** (1 / 12))
    return levels


def get_cpi_level_at(col: str, date_str: str, market: MarketMap) -> float | None:
    """Return cumulative CPI level at date, falling back to nearest earlier level."""
    levels = get_global_cpi_levels(col, market)
    if date_str in levels:
        return levels[date_str]
    # walk backwards through available dates
    all_dates = sorted(market.keys())
    idx = next((i for i, d in enumerate(all_dates) if d == date_str), -1)
    if idx < 0:
        return None
    for d in reversed(all_dates[: idx + 1]):
        if d in levels:
            return levels[d]
    return None


def build_cpi_series(col: str, dates: list[str], market: MarketMap) -> list[float] | None:
    """Return CPI series rebased to 100 at dates[0]."""
    start = get_cpi_level_at(col, dates[0], market)
    if not start:
        return None
    out: list[float] = []
    for d in dates:
        lvl = get_cpi_level_at(col, d, market)
        if lvl is None:
            return None
        out.append(lvl / start * 100)
    return out
