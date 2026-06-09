"""Synthetic deposit-return series.

Models a RUB deposit re-opened every `term_months` at the current CBR
top-10 max deposit rate (linear accrual within a period, compounding at
the end). Result is a cumulative level rebased to 100 at dates[0].
"""

from __future__ import annotations

import bisect
import calendar
import datetime as _dt


def _add_months(d: _dt.date, m: int) -> _dt.date:
    y = d.year + (d.month - 1 + m) // 12
    mm = (d.month - 1 + m) % 12 + 1
    day = min(d.day, calendar.monthrange(y, mm)[1])
    return _dt.date(y, mm, day)


def build_deposit_series(
    term_months: int,
    dates: list[str],
    rates: list[tuple[_dt.date, float]],
) -> list[float] | None:
    """Build deposit cumulative-return series rebased to 100 at dates[0].

    Args:
        term_months: re-open period (capitalization interval), e.g. 6.
        dates: ISO date strings, ascending.
        rates: (date, annual %) sorted ascending. The rate effective for
               a day is the last one with date ≤ that day.

    Returns None if dates is empty, term_months < 1, no rate available
    before dates[0], or rates list is empty.
    """
    if not dates or term_months < 1 or not rates:
        return None

    rate_dates = [r[0] for r in rates]
    rate_vals = [r[1] for r in rates]

    def rate_at(d: _dt.date) -> float | None:
        idx = bisect.bisect_right(rate_dates, d) - 1
        return rate_vals[idx] if idx >= 0 else None

    start = _dt.date.fromisoformat(dates[0])
    if rate_at(start) is None:
        # No published rate on/before start — can't build.
        return None

    capital = 1.0      # level after last capitalization
    accrued = 0.0      # fractional accrual since last cap (additive, not compounded within period)
    prev_d = start
    next_cap = _add_months(start, term_months)
    out: list[float] = [100.0]

    for ds in dates[1:]:
        d = _dt.date.fromisoformat(ds)

        # Cross any capitalization boundaries between prev_d and d.
        while next_cap <= d:
            r = rate_at(prev_d) or 0.0
            days = (next_cap - prev_d).days
            accrued += r / 100.0 * days / 365.0
            capital *= 1.0 + accrued
            accrued = 0.0
            prev_d = next_cap
            next_cap = _add_months(next_cap, term_months)

        # Accrue from prev_d to d at current rate.
        r = rate_at(prev_d) or 0.0
        days = (d - prev_d).days
        accrued += r / 100.0 * days / 365.0
        prev_d = d
        out.append(capital * (1.0 + accrued) * 100.0)

    return out
