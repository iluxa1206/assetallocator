"""Fund catalog endpoints — public read + superuser CRUD + batch NAV series + per-fund quote editing.

All metric values (`ret`, `bench_ret`, `cagr`, `vol`, `max_dd`) are returned as decimals
(0.34 = 34%). Frontend formats with `fmtPct`.
"""

import csv
import io
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calculations.constants import INDEX_TO_COL
from app.calculations.metrics import calc_metrics
from app.core.users import current_active_user, current_superuser
from app.db.session import get_async_session
from app.models.fund import Fund, FundCatalogQuote as FundQuote
from app.models.market_data import MarketDataPoint
from app.schemas.fund import FundCreate, FundOut, FundUpdate
from app.schemas.fund_quote import BulkUploadResult, FundQuoteIn, FundQuoteOut

router = APIRouter(prefix="/funds", tags=["funds"])


# ──────────────── Batch NAV series ────────────────
# IMPORTANT: declared before /{key} routes so /funds/series isn't captured by /funds/{key}.


def _downsample_indices(n: int, target: int = 40) -> list[int]:
    """Indices to keep when downsampling `n` points to `target`. Identity if n<=target.

    Returned once so several parallel arrays (fund line + benchmark line) sample at the
    exact same positions and stay aligned on the chart.
    """
    if n <= target:
        return list(range(n))
    step = n / target
    return [int(i * step) for i in range(target)]


# Cutoff windows for the range switcher. "ytd" / "max" are handled separately.
_RANGE_DAYS = {"1m": 30, "3m": 90, "6m": 180, "12m": 365, "1y": 365, "2y": 730, "3y": 1095}


def _market_val_at(d: date, col: str, sorted_dates: list[date], market_by_date: dict) -> float | None:
    """Benchmark index value on the last market date <= `d` (nearest-preceding)."""
    import bisect

    pos = bisect.bisect_right(sorted_dates, d) - 1
    if pos < 0:
        return None
    row = market_by_date.get(sorted_dates[pos])
    if row is None:
        return None
    return getattr(row, col, None)


def _step_returns(series: list[float]) -> list[float]:
    return [series[i] / series[i - 1] - 1 for i in range(1, len(series)) if series[i - 1] > 0]


def _beta(fund_norm: list[float], bench_norm: list[float]) -> float | None:
    """Beta = cov(fund, bench) / var(bench) over step returns. Sensitivity to the benchmark."""
    if len(fund_norm) != len(bench_norm) or len(fund_norm) < 3:
        return None
    fr = [fund_norm[i] / fund_norm[i - 1] - 1 for i in range(1, len(fund_norm))]
    br = [bench_norm[i] / bench_norm[i - 1] - 1 for i in range(1, len(bench_norm))]
    n = len(fr)
    mf = sum(fr) / n
    mb = sum(br) / n
    cov = sum((fr[i] - mf) * (br[i] - mb) for i in range(n)) / n
    var = sum((b - mb) ** 2 for b in br) / n
    return cov / var if var > 0 else None


@router.get("/series")
async def funds_series(
    range_: str = Query("max", alias="range"),
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> dict[str, Any]:
    """`range` = "1m"|"3m"|"6m"|"12m"|"2y"|"3y"|"ytd"|"max". Returns {fund_key: {points, bench_points, ret, ...}}."""
    funds = list((await session.scalars(select(Fund).where(Fund.is_active.is_(True)))).all())

    latest = await session.scalar(select(FundQuote.date).order_by(FundQuote.date.desc()).limit(1))
    if latest is None:
        return {}

    # Fetch the full history; the window is applied per-fund below by anchoring on the
    # last point at/before the window boundary (so short windows on monthly data still
    # get a baseline point and the return is measured from the right anchor).
    cutoff = date(1970, 1, 1)

    rows = (await session.execute(
        select(FundQuote.fund_key, FundQuote.date, FundQuote.price_rub, FundQuote.price_native)
        .where(FundQuote.date >= cutoff)
        .order_by(FundQuote.fund_key, FundQuote.date)
    )).all()
    # Per-fund tuples: (date, price_rub, price_native)
    by_fund: dict[str, list[tuple[date, float, float | None]]] = {}
    for k, d, p_rub, p_native in rows:
        by_fund.setdefault(k, []).append((d, p_rub, p_native))

    market_rows = (await session.execute(
        select(MarketDataPoint).where(MarketDataPoint.date >= cutoff).order_by(MarketDataPoint.date)
    )).scalars().all()
    market_by_date: dict[date, MarketDataPoint] = {m.date: m for m in market_rows}
    sorted_market_dates = sorted(market_by_date.keys())

    result: dict[str, dict[str, Any]] = {}
    empty = {
        "points": [], "bench_points": None, "ret": None, "bench_ret": None,
        "since": None, "currency": "RUB", "ytd_start_idx": None,
        "sharpe": None, "beta": None,
    }

    for fund in funds:
        raw = by_fund.get(fund.key, [])
        if len(raw) < 2:
            result[fund.key] = empty.copy()
            continue

        # Pick price series matching fund's native currency. Fall back to RUB if any point misses native.
        use_native = fund.native_currency != "RUB" and all(p_native is not None for _, _, p_native in raw)
        used_currency = fund.native_currency if use_native else "RUB"
        series: list[tuple[date, float]] = (
            [(d, p_native) for d, _, p_native in raw if p_native is not None]
            if use_native
            else [(d, p_rub) for d, p_rub, _ in raw]
        )

        # Anchor the window on the last point at/before its boundary, so the baseline is the
        # prior close (YTD → prior year-end; rolling → ~N months ago) and there's always ≥2 points.
        # Boundary is relative to THIS fund's last quote — funds have different coverage, and a
        # global "latest" would push short windows past a fund that stopped reporting earlier.
        fund_last = series[-1][0]
        if range_ == "ytd":
            boundary = date(fund_last.year, 1, 1)  # anchor = last point strictly before Jan 1
            strict = True
        elif range_ in _RANGE_DAYS:
            boundary = fund_last - timedelta(days=_RANGE_DAYS[range_])
            strict = False
        else:  # "max"
            boundary = None
            strict = False
        if boundary is not None:
            anchor = 0
            for i, (d, _p) in enumerate(series):
                if (d < boundary) if strict else (d <= boundary):
                    anchor = i
                else:
                    break
            series = series[anchor:]
            if len(series) < 2:
                result[fund.key] = empty.copy()
                continue

        v0 = series[0][1]
        if v0 <= 0:
            result[fund.key] = empty.copy()
            continue

        normed = [(d, p / v0 * 100.0) for d, p in series]
        ret = series[-1][1] / v0 - 1.0  # decimal

        # Benchmark line — same dates as the fund, normalized to 100 at the first point so it
        # overlays on the fund's scale. None if the index is unknown or any point is missing.
        bench_ret: float | None = None
        bench_norm: list[float] | None = None
        col = INDEX_TO_COL.get(fund.benchmark)
        if col is not None:
            b_raw = [_market_val_at(d, col, sorted_market_dates, market_by_date) for d, _ in series]
            b0 = b_raw[0] if b_raw else None
            if b0 and b0 > 0 and all(v is not None and v > 0 for v in b_raw):
                bench_norm = [v / b0 * 100.0 for v in b_raw]  # type: ignore[operator]
                bench_ret = b_raw[-1] / b0 - 1.0  # type: ignore[operator]

        metrics = calc_metrics([v for _, v in normed], [d.isoformat() for d, _ in normed])

        # Management-effectiveness extras: Sharpe (rf=0) and Beta vs the benchmark.
        sharpe = metrics["cagr"] / metrics["vol"] if metrics and metrics["vol"] > 0 else None
        beta = _beta([v for _, v in normed], bench_norm) if bench_norm is not None else None

        # One set of indices → fund line and benchmark line stay aligned after downsampling.
        idxs = _downsample_indices(len(normed), 40)
        ds_dates = [normed[i][0] for i in idxs]
        ytd_threshold = date(series[-1][0].year, 1, 1)
        ytd_start_idx: int | None = next((i for i, d in enumerate(ds_dates) if d >= ytd_threshold), None)

        result[fund.key] = {
            "points": [normed[i][1] for i in idxs],
            "bench_points": [bench_norm[i] for i in idxs] if bench_norm is not None else None,
            "ret": ret,
            "bench_ret": bench_ret,
            "bench_label": fund.benchmark_label or fund.benchmark,
            "currency": used_currency,
            "since": series[0][0].isoformat(),
            "as_of": series[-1][0].isoformat(),
            "ytd_start_idx": ytd_start_idx,
            "cagr": metrics["cagr"] if metrics else None,
            "vol": metrics["vol"] if metrics else None,
            "max_dd": metrics["max_dd"] if metrics else None,
            "sharpe": sharpe,
            "beta": beta,
        }

    return result


# ──────────────── CRUD ────────────────


@router.get("", response_model=list[FundOut])
async def list_funds(
    category: str | None = None,
    currency: str | None = None,
    risk: int | None = None,
    include_inactive: bool = False,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> list[Fund]:
    stmt = select(Fund).order_by(Fund.sort_order)
    if not include_inactive:
        stmt = stmt.where(Fund.is_active.is_(True))
    if category:
        stmt = stmt.where(Fund.category == category)
    if currency:
        stmt = stmt.where(Fund.native_currency == currency)
    if risk is not None:
        stmt = stmt.where(Fund.risk_score == risk)
    return list((await session.scalars(stmt)).all())


@router.get("/{key}", response_model=FundOut)
async def get_fund(
    key: str,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> Fund:
    fund = await session.get(Fund, key)
    if fund is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Fund {key!r} not found")
    return fund


@router.post("", response_model=FundOut, status_code=status.HTTP_201_CREATED)
async def create_fund(
    payload: FundCreate,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> Fund:
    if await session.get(Fund, payload.key):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Fund {payload.key!r} already exists")
    fund = Fund(**payload.model_dump(exclude_none=False))
    session.add(fund)
    await session.commit()
    await session.refresh(fund)
    return fund


@router.patch("/{key}", response_model=FundOut)
async def update_fund(
    key: str,
    payload: FundUpdate,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> Fund:
    fund = await session.get(Fund, key)
    if fund is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Fund {key!r} not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(fund, k, v)
    await session.commit()
    await session.refresh(fund)
    return fund


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fund(
    key: str,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> None:
    """Soft delete: sets is_active=False."""
    fund = await session.get(Fund, key)
    if fund is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Fund {key!r} not found")
    fund.is_active = False
    await session.commit()


# ──────────────── Fund NAV quotes (admin only) ────────────────


async def _ensure_fund_exists(key: str, session: AsyncSession) -> Fund:
    fund = await session.get(Fund, key)
    if fund is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Fund {key!r} not found")
    return fund


@router.get("/{key}/quotes", response_model=list[FundQuoteOut])
async def list_quotes(
    key: str,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> list[FundQuote]:
    await _ensure_fund_exists(key, session)
    stmt = select(FundQuote).where(FundQuote.fund_key == key).order_by(FundQuote.date)
    if date_from:
        stmt = stmt.where(FundQuote.date >= date_from)
    if date_to:
        stmt = stmt.where(FundQuote.date <= date_to)
    return list((await session.scalars(stmt)).all())


@router.post("/{key}/quotes", response_model=FundQuoteOut, status_code=status.HTTP_201_CREATED)
async def create_quote(
    key: str,
    payload: FundQuoteIn,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> FundQuote:
    await _ensure_fund_exists(key, session)
    existing = await session.scalar(
        select(FundQuote).where(FundQuote.fund_key == key, FundQuote.date == payload.date)
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Quote for {payload.date} already exists")
    quote = FundQuote(fund_key=key, **payload.model_dump())
    session.add(quote)
    await session.commit()
    await session.refresh(quote)
    return quote


@router.patch("/{key}/quotes/{quote_id}", response_model=FundQuoteOut)
async def update_quote(
    key: str,
    quote_id: int,
    payload: FundQuoteIn,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> FundQuote:
    quote = await session.get(FundQuote, quote_id)
    if quote is None or quote.fund_key != key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quote not found")
    quote.date = payload.date
    quote.price_rub = payload.price_rub
    quote.price_native = payload.price_native
    await session.commit()
    await session.refresh(quote)
    return quote


@router.delete("/{key}/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quote(
    key: str,
    quote_id: int,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> None:
    quote = await session.get(FundQuote, quote_id)
    if quote is None or quote.fund_key != key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quote not found")
    await session.delete(quote)
    await session.commit()


@router.post("/{key}/quotes/bulk", response_model=BulkUploadResult)
async def bulk_upload_quotes(
    key: str,
    file: UploadFile,
    replace: bool = False,
    session: AsyncSession = Depends(get_async_session),
    _admin=Depends(current_superuser),
) -> BulkUploadResult:
    """Bulk upload NAV from CSV. Required columns: `date`, `price_rub`. Optional: `price_native`.

    `replace=true` wipes existing quotes for this fund before loading.
    Duplicate dates within the file are skipped (first wins).
    """
    await _ensure_fund_exists(key, session)

    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    if reader.fieldnames is None or "date" not in reader.fieldnames or "price_rub" not in reader.fieldnames:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "CSV must contain `date` and `price_rub` columns (optional `price_native`)",
        )

    if replace:
        await session.execute(delete(FundQuote).where(FundQuote.fund_key == key))
        await session.flush()

    existing_dates = set(
        (await session.scalars(select(FundQuote.date).where(FundQuote.fund_key == key))).all()
    )

    inserted = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    seen: set[date] = set()

    for i, row in enumerate(reader, start=2):  # row 1 = header
        try:
            d = datetime.strptime(row["date"].strip(), "%Y-%m-%d").date()
        except (ValueError, KeyError, AttributeError):
            errors.append(f"row {i}: bad `date` ({row.get('date')!r})")
            skipped += 1
            continue
        if d in seen:
            skipped += 1
            continue
        seen.add(d)
        try:
            p_rub = float(row["price_rub"].replace(",", ".").strip())
        except (ValueError, KeyError, AttributeError):
            errors.append(f"row {i}: bad `price_rub`")
            skipped += 1
            continue
        p_native: float | None = None
        if (raw_native := row.get("price_native")):
            try:
                p_native = float(raw_native.replace(",", ".").strip())
            except ValueError:
                errors.append(f"row {i}: bad `price_native`, kept null")

        if d in existing_dates:
            existing = await session.scalar(
                select(FundQuote).where(FundQuote.fund_key == key, FundQuote.date == d)
            )
            assert existing is not None
            existing.price_rub = p_rub
            existing.price_native = p_native
            updated += 1
        else:
            session.add(FundQuote(fund_key=key, date=d, price_rub=p_rub, price_native=p_native))
            inserted += 1

    await session.commit()
    return BulkUploadResult(inserted=inserted, updated=updated, skipped=skipped, errors=errors[:50])


# ──────────────── Performance tables ────────────────


def _nearest_idx(dates: list[date], target: date) -> int | None:
    """Index of the last date <= target."""
    lo, hi = 0, len(dates) - 1
    if not dates or dates[0] > target:
        return None
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if dates[mid] <= target:
            lo = mid
        else:
            hi = mid - 1
    return lo


def _abs_and_annual(v0: float, vn: float, days: int) -> tuple[float, float | None]:
    if v0 <= 0:
        return (0.0, None)
    abs_ret = vn / v0 - 1.0
    if days < 30:
        return (abs_ret, None)
    annual = (vn / v0) ** (365.0 / days) - 1.0
    return (abs_ret, annual)


@router.get("/{key}/performance")
async def fund_performance(
    key: str,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> dict[str, Any]:
    """Period returns + month-by-month grid.

    Returns:
      - `periods`: {"1m": {"abs": …, "annual": …}, "3m": …, "6m": …, "1y": …, "3y": …, "ytd": …, "inception": …}
      - `monthly`: [{"date": "YYYY-MM", "ret": <decimal>}, …]  (one entry per closed month)
    """
    fund = await _ensure_fund_exists(key, session)
    rows = (await session.execute(
        select(FundQuote.date, FundQuote.price_rub, FundQuote.price_native)
        .where(FundQuote.fund_key == key)
        .order_by(FundQuote.date)
    )).all()

    if len(rows) < 2:
        return {"periods": {}, "monthly": [], "currency": "RUB"}

    # Pick currency matching fund. Fall back to RUB if any price_native missing.
    use_native = fund.native_currency != "RUB" and all(p_n is not None for _, _, p_n in rows)
    used_currency = fund.native_currency if use_native else "RUB"
    dates: list[date] = [d for d, _, _ in rows]
    prices: list[float] = (
        [p_n for _, _, p_n in rows if p_n is not None]
        if use_native
        else [p_rub for _, p_rub, _ in rows]
    )
    latest_idx = len(dates) - 1
    latest_d = dates[latest_idx]
    latest_p = prices[latest_idx]

    period_days = {
        "1m": 30,
        "3m": 90,
        "6m": 180,
        "1y": 365,
        "3y": 365 * 3,
    }

    periods: dict[str, dict[str, float | None]] = {}
    for label, days in period_days.items():
        target = latest_d - timedelta(days=days)
        idx = _nearest_idx(dates, target)
        if idx is None or idx == latest_idx:
            continue
        actual_days = (latest_d - dates[idx]).days
        abs_r, ann_r = _abs_and_annual(prices[idx], latest_p, actual_days)
        periods[label] = {"abs": abs_r, "annual": ann_r}

    # YTD
    ytd_target = date(latest_d.year, 1, 1)
    idx_ytd = _nearest_idx(dates, ytd_target)
    if idx_ytd is not None and idx_ytd != latest_idx:
        days_ytd = (latest_d - dates[idx_ytd]).days
        abs_r, ann_r = _abs_and_annual(prices[idx_ytd], latest_p, days_ytd)
        periods["ytd"] = {"abs": abs_r, "annual": ann_r}

    # Since inception (first available point)
    days_inc = (latest_d - dates[0]).days
    abs_r, ann_r = _abs_and_annual(prices[0], latest_p, days_inc)
    periods["inception"] = {"abs": abs_r, "annual": ann_r}

    # Monthly closing prices → month-over-month returns
    by_month: dict[tuple[int, int], float] = {}
    for d, p in zip(dates, prices, strict=True):
        by_month[(d.year, d.month)] = p   # latest price wins (dates are sorted asc)

    monthly: list[dict[str, Any]] = []
    sorted_months = sorted(by_month.keys())
    prev_price: float | None = None
    for ym in sorted_months:
        p = by_month[ym]
        if prev_price is None or prev_price <= 0:
            ret: float | None = None
        else:
            ret = p / prev_price - 1.0
        monthly.append({"date": f"{ym[0]:04d}-{ym[1]:02d}", "ret": ret})
        prev_price = p

    return {
        "periods": periods,
        "monthly": monthly,
        "currency": used_currency,
        "as_of": latest_d.isoformat(),
        "since": dates[0].isoformat(),
    }
