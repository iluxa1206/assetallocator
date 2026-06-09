"""Application scheduler — APScheduler bound to FastAPI lifespan.

Currently runs:
  - daily CBR deposit-rate refresh at 06:00 server time
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.session import async_session_maker
from app.services.cbr_deposits import upsert_cbr_max_rates

logger = logging.getLogger(__name__)


async def _refresh_cbr_deposits() -> None:
    try:
        async with async_session_maker() as session:
            n = await upsert_cbr_max_rates(session)
        logger.info("Scheduled CBR deposit refresh: %d rows", n)
    except Exception as exc:
        logger.exception("CBR deposit refresh failed: %s", exc)


def build_scheduler() -> AsyncIOScheduler:
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        _refresh_cbr_deposits,
        CronTrigger(hour=6, minute=0),
        id="cbr_deposit_refresh",
        replace_existing=True,
    )
    return sched
