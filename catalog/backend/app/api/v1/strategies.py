"""Strategy catalog endpoints — public read + superuser CRUD + backtested NAV series."""

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calculations.constants import FUND_META
from app.calculations.metrics import calc_metrics
from app.core.users import current_active_user, current_superuser
from app.db.session import get_async_session
from app.models.strategy import Strategy
from app.schemas.portfolio import PortfolioRequest
from app.schemas.strategy import StrategyCreate, StrategyOut, StrategyUpdate
from app.services.portfolio_service import compute_portfolio

router = APIRouter(prefix="/strategies", tags=["strategies"])

# Cutoff windows for the range switcher. "ytd" / "max" handled separately.
_RANGE_DAYS = {"1m": 30, "3m": 90, "6m": 180, "12m": 365, "1y": 365, "2y": 730, "3y": 1095}


def _downsample_indices(n: int, target: int = 40) -> list[int]:
    if n <= target:
        return list(range(n))
    step = n / target
    return [int(i * step) for i in range(target)]


@router.get("", response_model=list[StrategyOut])
async def list_strategies(
    risk_profile: str | None = None,
    ccy_strategy: str | None = None,
    include_inactive: bool = False,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> list[Strategy]:
    stmt = select(Strategy).order_by(Strategy.sort_order)
    if not include_inactive:
        stmt = stmt.where(Strategy.is_active.is_(True))
    if risk_profile:
        stmt = stmt.where(Strategy.risk_profile == risk_profile)
    if ccy_strategy:
        stmt = stmt.where(Strategy.ccy_strategy == ccy_strategy)
    return list((await session.scalars(stmt)).all())


@router.get("/{code}/series")
async def strategy_series(
    code: str,
    range_: str = Query("max", alias="range"),
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> dict[str, Any]:
    """Backtested NAV of the strategy's composition, computed by the dashboard portfolio
    engine starting from the strategy's `inception_date`.

    `range` = "1m"|"3m"|"6m"|"12m"|"ytd"|"max". Returns the same shape as `/funds/series`
    entries: {points, bench_points, ret, bench_ret, cagr, vol, max_dd, since, as_of, ...}.
    """
    empty = {
        "points": [], "bench_points": None, "ret": None, "bench_ret": None,
        "since": None, "currency": "RUB", "ytd_start_idx": None,
    }
    strat = await session.scalar(select(Strategy).where(Strategy.code == code))
    if strat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Strategy {code!r} not found")

    # Engine backtest only covers funds with historical NAV in FUND_META. Custom catalog
    # funds added later have no backtest series → drop them to avoid a 500 (KeyError).
    comp = {
        k: float(v)
        for k, v in (strat.composition or {}).items()
        if v and v > 0 and k in FUND_META
    }
    if not comp:
        return empty

    # Full series from the strategy's launch (or earliest valid date if unset).
    req = PortfolioRequest(
        risk="base",
        ccy="equal",
        base_currency="RUB",
        manual=True,
        manual_funds=comp,
        start_date=strat.inception_date.isoformat() if strat.inception_date else None,
    )
    resp = await compute_portfolio(req, session)

    dates_iso = resp.dates
    port = resp.portfolio_series
    bench = resp.benchmark_series
    if not dates_iso or len(port) < 2:
        return empty

    dates = [date.fromisoformat(d) for d in dates_iso]
    latest = dates[-1]
    # Anchor the window on the last point at/before its boundary, so the baseline is the prior
    # close (YTD → prior year-end; rolling → ~N months ago) and short windows keep ≥2 points.
    if range_ == "ytd":
        boundary = date(latest.year, 1, 1)  # anchor = last point strictly before Jan 1
        strict = True
    elif range_ in _RANGE_DAYS:
        boundary = latest - timedelta(days=_RANGE_DAYS[range_])
        strict = False
    else:  # "max"
        boundary = None
        strict = False

    start_idx = 0
    if boundary is not None:
        for i, d in enumerate(dates):
            if (d < boundary) if strict else (d <= boundary):
                start_idx = i
            else:
                break
    if start_idx >= len(port) - 1:
        start_idx = 0

    win_dates = dates[start_idx:]
    p0 = port[start_idx]
    if p0 <= 0:
        return empty
    port_norm = [v / p0 * 100.0 for v in port[start_idx:]]
    ret = port[-1] / p0 - 1.0

    bench_norm: list[float] | None = None
    bench_ret: float | None = None
    if bench is not None and len(bench) == len(port):
        b0 = bench[start_idx]
        if b0 and b0 > 0:
            bench_norm = [v / b0 * 100.0 for v in bench[start_idx:]]
            bench_ret = bench[-1] / b0 - 1.0

    metrics = calc_metrics(port_norm, [d.isoformat() for d in win_dates])

    idxs = _downsample_indices(len(port_norm), 40)
    ds_dates = [win_dates[i] for i in idxs]
    ytd_threshold = date(latest.year, 1, 1)
    ytd_start_idx = next((i for i, d in enumerate(ds_dates) if d >= ytd_threshold), None)

    return {
        "points": [port_norm[i] for i in idxs],
        "bench_points": [bench_norm[i] for i in idxs] if bench_norm is not None else None,
        "ret": ret,
        "bench_ret": bench_ret,
        "bench_label": "Композитный бенчмарк",
        "currency": "RUB",
        "since": win_dates[0].isoformat(),
        "as_of": win_dates[-1].isoformat(),
        "ytd_start_idx": ytd_start_idx,
        "cagr": metrics["cagr"] if metrics else None,
        "vol": metrics["vol"] if metrics else None,
        "max_dd": metrics["max_dd"] if metrics else None,
    }


@router.get("/{code}", response_model=StrategyOut)
async def get_strategy(
    code: str,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> Strategy:
    strat = await session.scalar(select(Strategy).where(Strategy.code == code))
    if strat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Strategy {code!r} not found")
    return strat


@router.post("", response_model=StrategyOut, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    payload: StrategyCreate,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> Strategy:
    existing = await session.scalar(select(Strategy).where(Strategy.code == payload.code))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Strategy {payload.code!r} already exists")
    strat = Strategy(**payload.model_dump(exclude_none=False))
    session.add(strat)
    await session.commit()
    await session.refresh(strat)
    return strat


@router.patch("/{code}", response_model=StrategyOut)
async def update_strategy(
    code: str,
    payload: StrategyUpdate,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> Strategy:
    strat = await session.scalar(select(Strategy).where(Strategy.code == code))
    if strat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Strategy {code!r} not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(strat, k, v)
    await session.commit()
    await session.refresh(strat)
    return strat


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_strategy(
    code: str,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> None:
    """Soft delete: sets is_active=False."""
    strat = await session.scalar(select(Strategy).where(Strategy.code == code))
    if strat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Strategy {code!r} not found")
    strat.is_active = False
    await session.commit()
