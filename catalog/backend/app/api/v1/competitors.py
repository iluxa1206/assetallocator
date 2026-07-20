"""Competitor-funds comparison endpoints for the /competitors tab.

Competitors are `funds` rows with kind in (competitor, benchmark). They reuse the
NAV series engine (`_compute_series`) and are merged with fund metadata into a
leaderboard the frontend sorts client-side. Sync endpoints pull fresh quotes from
MOEX ISS / investfunds.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.funds import _compute_series
from app.core.users import current_full_user, current_superuser
from app.db.session import get_async_session
from app.models.fund import Fund, FundCatalogQuote
from app.services.competitor_sync import sync_all_competitors, sync_fund

router = APIRouter(prefix="/competitors", tags=["competitors"])


@router.get("/peer-groups")
async def peer_groups(
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_full_user),
) -> list[str]:
    """Distinct peer_group buckets present on competitor funds (for the filter UI)."""
    rows = (
        await session.scalars(
            select(Fund.peer_group)
            .where(Fund.kind.in_(("competitor", "benchmark")), Fund.peer_group.isnot(None))
            .distinct()
        )
    ).all()
    return sorted(r for r in rows if r)


@router.get("/leaderboard")
async def leaderboard(
    range_: str = Query("12m", alias="range"),
    peer_group: str | None = None,
    include_own: bool = False,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_full_user),
) -> list[dict[str, Any]]:
    """Ranking rows: fund metadata + normalized series + period metrics.

    `include_own=true` folds our own funds into the comparison for benchmarking.
    """
    kinds = ["competitor", "benchmark"]
    if include_own:
        kinds.append("own")
    q = select(Fund).where(Fund.is_active.is_(True), Fund.kind.in_(kinds))
    if peer_group:
        q = q.where(Fund.peer_group == peer_group)
    funds = list((await session.scalars(q)).all())

    # Month-binned so daily competitor funds align with month-end own funds on the overlay.
    series = await _compute_series(funds, range_, session, monthly=True)
    meta = {f.key: f for f in funds}

    rows: list[dict[str, Any]] = []
    for key, s in series.items():
        f = meta[key]
        rows.append(
            {
                "key": key,
                "name": f.name,
                "short_name": f.short_name,
                "provider": f.provider,
                "peer_group": f.peer_group,
                "kind": f.kind,
                "contract_type": f.contract_type,
                "source": f.source,
                "last_synced_at": f.last_synced_at.isoformat() if f.last_synced_at else None,
                **s,
            }
        )
    # Default order: best period return first (None sinks to the bottom).
    rows.sort(key=lambda r: (r.get("ret") is None, -(r.get("ret") or 0.0)))
    return rows


@router.get("/{key}/monthly")
async def monthly_detail(
    key: str,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_full_user),
) -> dict[str, Any]:
    """Month-end unit price + month-over-month return for the expandable fund panel."""
    fund = await session.scalar(select(Fund).where(Fund.key == key))
    if fund is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="fund not found")

    quotes = (
        await session.execute(
            select(FundCatalogQuote.date, FundCatalogQuote.price_rub)
            .where(FundCatalogQuote.fund_key == key)
            .order_by(FundCatalogQuote.date)
        )
    ).all()

    # Collapse to the last quote of each calendar month (date-ascending → later write wins).
    by_month: dict[tuple[int, int], tuple[Any, float]] = {}
    for d, p in quotes:
        by_month[(d.year, d.month)] = (d, p)

    rows: list[dict[str, Any]] = []
    prev: float | None = None
    for ym in sorted(by_month):
        d, price = by_month[ym]
        ret = (price / prev - 1.0) if prev and prev > 0 else None
        rows.append(
            {"month": f"{ym[0]}-{ym[1]:02d}", "date": d.isoformat(), "price": price, "ret": ret}
        )
        prev = price

    return {"key": key, "name": fund.name, "provider": fund.provider, "rows": rows}


@router.post("/sync", status_code=status.HTTP_200_OK)
async def sync_all(
    full: bool = Query(False),
    session: AsyncSession = Depends(get_async_session),
    _superuser=Depends(current_superuser),
) -> dict[str, int]:
    """Pull fresh quotes for every competitor/benchmark fund. `full=true` re-backfills."""
    return await sync_all_competitors(session, full=full)


@router.post("/{key}/sync", status_code=status.HTTP_200_OK)
async def sync_one(
    key: str,
    full: bool = Query(False),
    session: AsyncSession = Depends(get_async_session),
    _superuser=Depends(current_superuser),
) -> dict[str, Any]:
    """Pull fresh quotes for a single competitor fund."""
    fund = await session.scalar(select(Fund).where(Fund.key == key))
    if fund is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="fund not found")
    inserted = await sync_fund(session, fund, full=full)
    await session.commit()
    return {
        "key": key,
        "inserted": inserted,
        "last_synced_at": fund.last_synced_at.isoformat() if fund.last_synced_at else None,
    }
