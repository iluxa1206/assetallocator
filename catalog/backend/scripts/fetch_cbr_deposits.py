"""CLI: fetch CBR deposit rates once. Usage: `uv run python scripts/fetch_cbr_deposits.py`."""

from __future__ import annotations

import asyncio
import logging

from app.db.session import async_session_maker
from app.services.cbr_deposits import upsert_cbr_max_rates


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    async with async_session_maker() as session:
        n = await upsert_cbr_max_rates(session)
    print(f"OK: {n} rows upserted")


if __name__ == "__main__":
    asyncio.run(main())
