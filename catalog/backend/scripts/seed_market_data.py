"""Seed market_data_points from Лист2 of фонды_111-11.xlsx.

Column layout (0-indexed, header row index 1):
  0: Дата
  1: RUSFAR      → rusfar
  2: RGBITR      → rgbitr
  3: MCFTR       → mcftr
  4: Cbonds ЗО USD → cbonds_zo_usd
  5: Cbonds ЗО RUB → cbonds_zo_rub
  6: RUCNYTR CNY → rucnytr_cny
  7: RUCNYTR RUB → rucnytr_rub
  8: GLDRUB      → gldrub
  9: CPI rub     → cpi_rub
 10: CPI USD     → cpi_usd
 11: CPI cny     → cpi_cny
 12: USDRUB      → usdrub
 13: CNYRUB      → cnyrub

Run inside Docker:
    docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
        uv run python -m scripts.seed_market_data
"""

from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path

import openpyxl
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.market_data import MarketDataPoint

XLSX_PATH = Path("/seed_data/фонды_111-11.xlsx")

COLUMNS = [
    "rusfar", "rgbitr", "mcftr",
    "cbonds_zo_usd", "cbonds_zo_rub",
    "rucnytr_cny", "rucnytr_rub",
    "gldrub",
    "cpi_rub", "cpi_usd", "cpi_cny",
    "usdrub", "cnyrub",
]


def _float(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_xlsx() -> list[dict]:
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True, read_only=True)
    ws = wb["Лист2"]
    rows = list(ws.iter_rows(values_only=True))
    # row 0: index numbers, row 1: headers, row 2+: data
    data_rows = rows[2:]

    result = []
    for r in data_rows:
        if not r or r[0] is None:
            continue
        d = r[0]
        if hasattr(d, "date"):
            d = d.date()
        if not isinstance(d, date):
            continue
        record: dict = {"date": d}
        for i, col in enumerate(COLUMNS, start=1):
            record[col] = _float(r[i] if i < len(r) else None)
        result.append(record)

    return result


async def main() -> None:
    path = XLSX_PATH
    if not path.exists():
        local = Path(__file__).resolve().parent.parent.parent / "seed_data" / "фонды_111-11.xlsx"
        if local.exists():
            path = local
        else:
            raise SystemExit(f"xlsx not found: {XLSX_PATH}")

    rows = parse_xlsx()
    print(f"Parsed {len(rows)} rows from Лист2 (since {rows[0]['date']} to {rows[-1]['date']})")

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        stmt = insert(MarketDataPoint).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["date"],
            set_={col: stmt.excluded[col] for col in COLUMNS},
        )
        await session.execute(stmt)
        await session.commit()

    await engine.dispose()
    print(f"Upserted {len(rows)} rows into market_data_points.")


if __name__ == "__main__":
    asyncio.run(main())
