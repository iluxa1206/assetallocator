"""Scrape CBR max deposit rate (top-10 banks, RUB) from avgprocstav page.

Source: https://www.cbr.ru/statistics/avgprocstav/

Page publishes a 2-column table:
    Декада     | Ставка, %
    II.05.2026 | 13,0350

Decade tokens:
    I   → 10th of month   (period 1–10)
    II  → 20th of month   (period 11–20)
    III → last day of mo  (period 21–end)
"""

from __future__ import annotations

import calendar
import datetime as _dt
import logging
import re

import httpx
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deposit_rate import DepositRateMax10

logger = logging.getLogger(__name__)

CBR_URL = (
    "https://www.cbr.ru/statistics/avgprocstav/"
    "?UniDbQuery.Posted=True"
    "&UniDbQuery.From=1.01.2020"
    "&UniDbQuery.To=31.12.2099"
)

_DECADE_RE = re.compile(r"^(I{1,3})\.(\d{2})\.(\d{4})$")
_ROMAN_TO_INT = {"I": 1, "II": 2, "III": 3}


def _decade_to_date(token: str) -> _dt.date:
    """`II.05.2026` → date(2026, 5, 20)."""
    m = _DECADE_RE.match(token.strip())
    if not m:
        raise ValueError(f"bad decade token: {token!r}")
    roman, mm, yyyy = m.groups()
    year, month = int(yyyy), int(mm)
    dec = _ROMAN_TO_INT[roman]
    if dec == 1:
        day = 10
    elif dec == 2:
        day = 20
    else:
        day = calendar.monthrange(year, month)[1]
    return _dt.date(year, month, day)


def _parse_rate(raw: object) -> float:
    """`'13,0350'` → 13.035."""
    s = str(raw).strip().replace(" ", "").replace(" ", "").replace(",", ".")
    return float(s)


# Match a CBR table row like:
#   <tr><td>II.05.2026</td><td>13,0350</td></tr>
# Whitespace and class attributes vary, so the regex stays loose.
_ROW_RE = re.compile(
    r"<tr\b[^>]*>\s*<td\b[^>]*>\s*(I{1,3}\.\d{2}\.\d{4})\s*</td>"
    r"\s*<td\b[^>]*>\s*([\d\s  ]+[,.]\d+)\s*</td>",
    re.IGNORECASE,
)


async def fetch_cbr_max_rates() -> list[tuple[_dt.date, float]]:
    """Download CBR avgprocstav page, parse decade rows.

    Returns list of (date, rate_pct). Empty list on failure (logged).
    """
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            r = await client.get(CBR_URL)
            r.raise_for_status()
            html = r.text
    except Exception as exc:
        logger.warning("CBR fetch failed: %s", exc)
        return []

    rows: list[tuple[_dt.date, float]] = []
    for decade_raw, rate_raw in _ROW_RE.findall(html):
        try:
            d = _decade_to_date(decade_raw)
            rate = _parse_rate(rate_raw)
        except (ValueError, TypeError):
            continue
        rows.append((d, rate))

    # Deduplicate by date (regex may match same row twice if structure repeats).
    rows = list({d: (d, r) for d, r in rows}.values())
    rows.sort(key=lambda x: x[0])
    if not rows:
        logger.warning("CBR table parse returned no rows")
    return rows


async def upsert_cbr_max_rates(session: AsyncSession) -> int:
    """Fetch + upsert. Returns number of (re)inserted rows."""
    rows = await fetch_cbr_max_rates()
    if not rows:
        return 0
    stmt = insert(DepositRateMax10).values(
        [{"date": d, "rate": r} for d, r in rows]
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["date"],
        set_={"rate": stmt.excluded.rate},
    )
    await session.execute(stmt)
    await session.commit()
    logger.info("CBR deposit rates upserted: %d rows", len(rows))
    return len(rows)
