"""Restore the dashboard backtest source `fund_quotes` from the original xlsx.

The catalog UI writes to `fund_catalog_quotes`. This script rebuilds the *other* table
(`fund_quotes`) read by the dashboard portfolio engine — so user edits in the catalog
no longer pollute the long extended backtest series.

Wipes only the funds present in the xlsx (R5/D5/Yu5/D1/VO/Aplus/A12080/R1/M3).
The synthetic Liq series stays as-is.

Run inside Docker:
    docker compose exec backend uv run python -m scripts.restore_backtest_quotes
"""

from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path
from typing import Any

import openpyxl
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.fund import FundQuote


# ──────────────── xlsx column layout ────────────────
# Columns inside `Лист1` for each fund (0-indexed).
# `native_col=None` means the fund is RUB-only — price_native stays NULL.
COLUMN_LAYOUT: dict[str, dict[str, int | None]] = {
    "R5":     {"date": 1,  "rub": 2,  "native": None},
    "D5":     {"date": 5,  "rub": 6,  "native": 7},
    "Yu5":    {"date": 10, "rub": 12, "native": 11},   # RUB / CNY swapped vs others
    "D1":     {"date": 15, "rub": 16, "native": 17},
    "VO":     {"date": 20, "rub": 21, "native": 22},
    "Aplus":  {"date": 25, "rub": 26, "native": None},
    "A12080": {"date": 29, "rub": 30, "native": None},
    "R1":     {"date": 33, "rub": 34, "native": None},
    "M3":     {"date": 37, "rub": 38, "native": 39},
}

XLSX_PATH = Path("/seed_data/фонды_111-11.xlsx")


def parse_xlsx() -> dict[str, list[tuple[date, float, float | None]]]:
    """Return {fund_key: [(date, price_rub, price_native), ...]} sorted by date."""
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True, read_only=True)
    ws = wb["Лист1"]
    rows = list(ws.iter_rows(values_only=True))[2:]  # skip 2 header rows

    out: dict[str, list[tuple[date, float, float | None]]] = {k: [] for k in COLUMN_LAYOUT}

    for r in rows:
        for key, cols in COLUMN_LAYOUT.items():
            d_idx = cols["date"]
            rub_idx = cols["rub"]
            native_idx = cols["native"]
            assert d_idx is not None and rub_idx is not None
            if d_idx >= len(r) or rub_idx >= len(r):
                continue
            d = r[d_idx]
            p_rub = r[rub_idx]
            if d is None or p_rub is None:
                continue
            if hasattr(d, "date"):
                d = d.date()
            try:
                p_rub_f = float(p_rub)
            except (TypeError, ValueError):
                continue
            p_native_f: float | None = None
            if native_idx is not None and native_idx < len(r):
                v = r[native_idx]
                if v is not None:
                    try:
                        p_native_f = float(v)
                    except (TypeError, ValueError):
                        p_native_f = None
            out[key].append((d, p_rub_f, p_native_f))

    # Dedupe by date keeping the last value (xlsx may have duplicates)
    for k, lst in out.items():
        by_d: dict[date, tuple[float, float | None]] = {}
        for d, r, n in lst:
            by_d[d] = (r, n)
        out[k] = [(d, r, n) for d, (r, n) in sorted(by_d.items())]

    return out


async def main() -> None:
    if not XLSX_PATH.exists():
        # Fallback path when running outside Docker (host)
        local = Path(__file__).resolve().parent.parent.parent / "seed_data" / "фонды_111-11.xlsx"
        if local.exists():
            globals()["XLSX_PATH"] = local
        else:
            raise SystemExit(f"xlsx not found: {XLSX_PATH} (also tried {local})")

    by_fund = parse_xlsx()
    print("Parsed from xlsx:")
    for k, rows in by_fund.items():
        print(f"  {k:>7}: {len(rows):>3} rows (since {rows[0][0] if rows else '—'})")

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        # Wipe only the funds we're restoring — leaves Liq (synthetic) intact.
        keys = list(by_fund.keys())
        await session.execute(delete(FundQuote).where(FundQuote.fund_key.in_(keys)))
        await session.flush()

        for key, rows in by_fund.items():
            for d, p_rub, p_native in rows:
                session.add(FundQuote(fund_key=key, date=d, price_rub=p_rub, price_native=p_native))

        await session.commit()

    await engine.dispose()
    print(f"Restored {sum(len(v) for v in by_fund.values())} fund_quotes rows from xlsx.")


if __name__ == "__main__":
    asyncio.run(main())
