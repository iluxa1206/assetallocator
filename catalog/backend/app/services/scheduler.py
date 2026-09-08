"""Application scheduler — APScheduler bound to FastAPI lifespan.

Currently runs:
  - daily CBR deposit-rate refresh at 06:00 UTC
  - daily competitor/benchmark NAV sync at 06:30 UTC
  - weekly own-fund NAV sync, Mondays at 06:45 UTC

Обе задачи ходят наружу (cbr.ru, iss.moex.com, investfunds.ru). Прод-контейнер
имеет egress — на это опирается уже работающий CBR-джоб.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.session import async_session_maker
from app.services.cbr_deposits import upsert_cbr_max_rates
from app.services.competitor_sync import sync_all_competitors
from app.services.own_fund_sync import sync_all_own_funds

logger = logging.getLogger(__name__)


async def _refresh_cbr_deposits() -> None:
    try:
        async with async_session_maker() as session:
            n = await upsert_cbr_max_rates(session)
        logger.info("Scheduled CBR deposit refresh: %d rows", n)
    except Exception as exc:
        logger.exception("CBR deposit refresh failed: %s", exc)


async def _sync_competitors() -> None:
    """Инкрементально дотягивает котировки конкурентов и бенчмарков.

    sync_all_competitors ловит ошибку каждого фонда отдельно (-1 в результате),
    так что падение одного источника не срывает остальные. Ряды с ошибкой
    подтянутся на следующем прогоне — синк идёт от последней сохранённой даты.
    """
    try:
        async with async_session_maker() as session:
            result = await sync_all_competitors(session)
        inserted = sum(n for n in result.values() if n > 0)
        failed = [k for k, n in result.items() if n < 0]
        logger.info(
            "Scheduled competitor sync: +%d quotes across %d funds%s",
            inserted,
            len([n for n in result.values() if n > 0]),
            f", failed: {', '.join(failed)}" if failed else "",
        )
    except Exception as exc:
        logger.exception("Competitor sync failed: %s", exc)


async def _sync_own_funds() -> None:
    """Дотягивает котировки собственных ИПИФ с investfunds.

    Раз в неделю, а не ежедневно: фонды публикуют цену пая раз в месяц, и
    ежедневные 14 запросов (по два на фонд — рубли и валюта) ради одной точки
    в месяц лишний раз тревожат источник. Недельный шаг всё равно ловит новую
    точку с запасом — синк инкрементальный, пропущенное догоняется.
    """
    try:
        async with async_session_maker() as session:
            result = await sync_all_own_funds(session)
        inserted = sum(n for n in result.values() if n > 0)
        failed = [k for k, n in result.items() if n < 0]
        logger.info(
            "Scheduled own-fund sync: +%d rows%s",
            inserted,
            f", failed: {', '.join(failed)}" if failed else "",
        )
    except Exception as exc:
        logger.exception("Own-fund sync failed: %s", exc)


def build_scheduler() -> AsyncIOScheduler:
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        _refresh_cbr_deposits,
        CronTrigger(hour=6, minute=0),
        id="cbr_deposit_refresh",
        replace_existing=True,
    )
    sched.add_job(
        _sync_competitors,
        CronTrigger(hour=6, minute=30),
        id="competitor_sync",
        replace_existing=True,
        # Источники иногда отдают день с задержкой; пропущенный из-за рестарта
        # запуск лучше догнать, чем ждать сутки.
        misfire_grace_time=3600,
        coalesce=True,
        max_instances=1,
    )
    sched.add_job(
        _sync_own_funds,
        CronTrigger(day_of_week="mon", hour=6, minute=45),
        id="own_fund_sync",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
        max_instances=1,
    )
    return sched
