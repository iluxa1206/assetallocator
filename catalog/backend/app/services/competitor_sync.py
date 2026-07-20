"""Fetch NAV/price series for competitor funds and upsert into `fund_catalog_quotes`.

Two data sources (both confirmed free, no auth):

- **MOEX ISS** — exchange-traded БПИФ/ETF and indices. Paginated JSON history.
    * index:  /iss/history/engines/stock/markets/index/securities/{secid}.json
    * fund:   /iss/history/engines/stock/markets/shares/boards/{board}/securities/{secid}.json
      (board TQTF for open БПИФ, TQIF for interval funds; secid may be the ISIN)
- **investfunds.ru** — classic ОПИФ/ИПИФ unit price (цена пая). The public chart XHR:
    GET https://investfunds.ru/funds/{id}/?action=chartData&data_key=pay&currencyId=1
        &date_from=DD.MM.YYYY&ids[]={id}   (header X-Requested-With: XMLHttpRequest)
    → [{"data": [[epoch_ms, price], ...], "name": "..."}]

Everything tracked here is RUB-denominated, so price_rub == price_native == fetched price.
"""

from __future__ import annotations

from datetime import date, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fund import Fund, FundCatalogQuote

_UA = "Mozilla/5.0 (compatible; AstraCatalog/1.0)"
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# Backfill anchor when a fund has no quotes yet.
_DEFAULT_SINCE = date(2019, 1, 1)


# ──────────────── MOEX ISS ────────────────


async def fetch_moex(
    client: httpx.AsyncClient,
    secid: str,
    board: str | None,
    since: date,
) -> list[tuple[date, float]]:
    """Daily close history from MOEX ISS. `board == "index"` → index endpoint.

    For funds we DON'T pin the board: exchange-traded funds migrate between boards
    (e.g. TBRU moved TQTF→TQBR in 2026), and a pinned board silently freezes the
    series at the migration date. Instead we hit the market-level securities endpoint
    (all boards) and dedup to one close per day, preferring the most-traded board
    (highest VALUE) when a date appears on several boards. Paginates via `start`.
    """
    is_index = board in (None, "index")
    if is_index:
        base = f"https://iss.moex.com/iss/history/engines/stock/markets/index/securities/{secid}.json"
    else:
        base = f"https://iss.moex.com/iss/history/engines/stock/markets/shares/securities/{secid}.json"

    # date -> (close, value) — keep the row with the largest turnover for that date.
    best: dict[date, tuple[float, float]] = {}
    start = 0
    while True:
        params = {"from": since.isoformat(), "start": start, "iss.meta": "off"}
        r = await client.get(base, params=params, headers={"User-Agent": _UA})
        r.raise_for_status()
        block = r.json().get("history", {})
        cols = block.get("columns", [])
        rows = block.get("data", [])
        if not rows:
            break
        try:
            di = cols.index("TRADEDATE")
            ci = cols.index("CLOSE")
        except ValueError:
            break
        vi = cols.index("VALUE") if "VALUE" in cols else None
        for row in rows:
            d_raw, close = row[di], row[ci]
            if d_raw is None or close is None:
                continue
            d = date.fromisoformat(d_raw)
            val = float(row[vi]) if vi is not None and row[vi] is not None else 0.0
            prev = best.get(d)
            if prev is None or val >= prev[1]:
                best[d] = (float(close), val)
        if len(rows) < 100:  # ISS pages are 100 rows; short page = last page
            break
        start += len(rows)
    return [(d, best[d][0]) for d in sorted(best)]


# ──────────────── investfunds.ru ────────────────


async def fetch_investfunds(
    client: httpx.AsyncClient,
    fund_id: str,
    since: date,
    data_key: str = "pay",
) -> list[tuple[date, float]]:
    """Daily unit price (цена пая) from the investfunds chart XHR. `data_key`: pay|sca."""
    url = f"https://investfunds.ru/funds/{fund_id}/"
    params = {
        "action": "chartData",
        "data_key": data_key,
        "currencyId": 1,
        "date_from": since.strftime("%d.%m.%Y"),
        "ids[]": fund_id,
    }
    r = await client.get(
        url,
        params=params,
        headers={"User-Agent": _UA, "X-Requested-With": "XMLHttpRequest"},
    )
    r.raise_for_status()
    payload = r.json()
    if not isinstance(payload, list) or not payload:
        return []
    series = payload[0].get("data") or []
    out: list[tuple[date, float]] = []
    for point in series:
        if not point or point[1] is None:
            continue
        epoch_ms, price = point[0], point[1]
        d = datetime.utcfromtimestamp(epoch_ms / 1000).date()
        out.append((d, float(price)))
    return out


# ──────────────── Orchestration ────────────────


async def sync_fund(session: AsyncSession, fund: Fund, full: bool = False) -> int:
    """Fetch new quotes for one competitor fund and upsert into fund_catalog_quotes.

    Incremental by default (from the day after the last stored quote). `full=True`
    re-fetches from the default backfill anchor. Returns count of inserted rows.
    """
    if not fund.source or not fund.source_ref:
        return 0

    last: date | None = None
    if not full:
        last = await session.scalar(
            select(FundCatalogQuote.date)
            .where(FundCatalogQuote.fund_key == fund.key)
            .order_by(FundCatalogQuote.date.desc())
            .limit(1)
        )
    since = last if last else _DEFAULT_SINCE

    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
        if fund.source == "moex":
            points = await fetch_moex(client, fund.source_ref, fund.source_board, since)
        elif fund.source == "investfunds":
            points = await fetch_investfunds(client, fund.source_ref, since)
        else:
            return 0

    if not points:
        fund.last_synced_at = datetime.utcnow()
        return 0

    # Dedup: one price per day (keep last seen), and skip dates already stored.
    by_day: dict[date, float] = {d: p for d, p in points}
    existing = set(
        (
            await session.scalars(
                select(FundCatalogQuote.date).where(FundCatalogQuote.fund_key == fund.key)
            )
        ).all()
    )
    inserted = 0
    for d in sorted(by_day):
        if d in existing:
            continue
        price = by_day[d]
        session.add(
            FundCatalogQuote(fund_key=fund.key, date=d, price_rub=price, price_native=price)
        )
        inserted += 1

    fund.last_synced_at = datetime.utcnow()
    await session.flush()
    return inserted


async def sync_all_competitors(session: AsyncSession, full: bool = False) -> dict[str, int]:
    """Sync every fund with kind in (competitor, benchmark). Returns {fund_key: inserted}."""
    funds = list(
        (
            await session.scalars(
                select(Fund).where(Fund.kind.in_(("competitor", "benchmark")))
            )
        ).all()
    )
    result: dict[str, int] = {}
    for fund in funds:
        try:
            result[fund.key] = await sync_fund(session, fund, full=full)
        except Exception as exc:  # noqa: BLE001 — log per-fund, keep syncing the rest
            result[fund.key] = -1
            print(f"[competitor_sync] {fund.key} failed: {exc!r}")
    await session.commit()
    return result
