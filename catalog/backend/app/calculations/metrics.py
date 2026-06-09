"""Portfolio performance metrics."""

import datetime
import math
from typing import TypedDict


class Metrics(TypedDict):
    total_ret: float
    cagr: float
    vol: float
    max_dd: float
    years: float


def calc_metrics(series: list[float], dates: list[str]) -> Metrics | None:
    """Compute CAGR (365-day base), annualised vol (monthly × √12), max drawdown."""
    if not series or len(series) < 2:
        return None
    v0, vn = series[0], series[-1]
    d0 = datetime.date.fromisoformat(dates[0])
    dn = datetime.date.fromisoformat(dates[-1])
    days = (dn - d0).days
    years = days / 365
    total_ret = vn / v0 - 1
    cagr = (vn / v0) ** (1 / years) - 1 if years > 0 else 0.0

    rets = [series[i] / series[i - 1] - 1 for i in range(1, len(series))]
    mean = sum(rets) / len(rets)
    variance = sum((r - mean) ** 2 for r in rets) / len(rets)
    vol = math.sqrt(variance) * math.sqrt(12)

    peak = series[0]
    max_dd = 0.0
    for v in series:
        if v > peak:
            peak = v
        dd = v / peak - 1
        if dd < max_dd:
            max_dd = dd

    return Metrics(total_ret=total_ret, cagr=cagr, vol=vol, max_dd=max_dd, years=years)
