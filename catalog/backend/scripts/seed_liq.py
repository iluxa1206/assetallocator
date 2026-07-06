"""Generate synthetic Liq (money-market fund) quotes from RUSFAR rates.

Liq price compounds monthly at the RUSFAR overnight rate (annualised %).
Starting NAV = 1000.0 at the first available market date.

Run inside Docker:
    docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
        uv run python -m scripts.seed_liq
"""

from __future__ import annotations

import asyncio

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.fund import FundQuote
from app.models.market_data import MarketDataPoint


async def main() -> None:
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        rows = (
            await session.execute(
                select(MarketDataPoint)
                .where(MarketDataPoint.rusfar.is_not(None))
                .order_by(MarketDataPoint.date)
            )
        ).scalars().all()

        if not rows:
            raise SystemExit("No RUSFAR data in market_data_points — run seed_market_data first.")

        # RUSFAR is a total-return index — use it directly as Liq NAV price.
        quotes: list[FundQuote] = [
            FundQuote(fund_key="Liq", date=r.date, price_rub=round(r.rusfar, 6))
            for r in rows
        ]

        await session.execute(delete(FundQuote).where(FundQuote.fund_key == "Liq"))
        session.add_all(quotes)
        await session.commit()

    await engine.dispose()
    print(f"Generated {len(quotes)} Liq quotes ({quotes[0].date} → {quotes[-1].date}).")


if __name__ == "__main__":
    asyncio.run(main())
