"""Seed competitor bond funds + RGBITR benchmark for the /competitors tab.

Idempotent upsert by `key`. Competitors live in the same `funds` table with
kind='competitor' (or 'benchmark') so they reuse the NAV series engine but stay
out of the /catalog listing (which filters kind='own').

Run (seed only):
    DATABASE_URL=postgresql+asyncpg://astra:astra_dev@localhost:5434/astra \
        .venv/bin/python -m scripts.seed_competitors

Run (seed + full NAV backfill from data sources):
    DATABASE_URL=... .venv/bin/python -m scripts.seed_competitors --sync
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.fund import Fund
from app.services.competitor_sync import sync_all_competitors

# peer_group buckets (strategy comparison filter):
#   corp_rub — corporate / mixed RUB bond funds
#   ofz      — ОФЗ / government-bond funds
#   money    — money-market / short treasury
# Tuple layout:
#   key, name, short_name, provider, source, source_ref, source_board, peer_group, contract_type, kind
COMPETITORS: list[tuple] = [
    ("comp_alfa_vdo", "Альфа-Капитал Высокодоходные облигации", "Альфа ВДО",
     "Альфа-Капитал", "investfunds", "10537", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_alfa_bondsplus", "Альфа-Капитал Облигации Плюс", "Альфа Облигации Плюс",
     "Альфа-Капитал", "investfunds", "33", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_psb_bonds", "ПСБ Облигации", "ПСБ Облигации",
     "УК Промсвязь (ПСБ)", "investfunds", "375", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_geroi_rub", "Герои Рублёвые перспективы", "Герои Рубл. перспективы",
     "УК Герои", "investfunds", "11073", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_bks_rusbonds", "БКС Российские облигации", "БКС Российские облигации",
     "БКС", "investfunds", "165", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_gpb_bondsplus", "Газпромбанк Облигации плюс", "ГПБ Облигации плюс",
     "Газпромбанк (ААА УК)", "investfunds", "2969", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_vim_treasury", "ВИМ Казначейский", "ВИМ Казначейский",
     "ВИМ Инвестиции (ВТБ)", "investfunds", "54", None, "money", "ОПИФ", "competitor"),
    ("comp_pervaya_rub", "Первая Фонд рублёвые сбережения", "Первая Рубл. сбережения",
     "УК Первая (Сбер)", "investfunds", "47", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_raiff_bonds", "Райффайзен Облигации", "Райффайзен Облигации",
     "УК Райффайзен", "investfunds", "280", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_aton_bonds", "АТОН Фонд облигаций", "АТОН Фонд облигаций",
     "АТОН", "investfunds", "775", None, "corp_rub", "ОПИФ", "competitor"),
    ("comp_aton_ofz", "АТОН ОФЗ", "АТОН ОФЗ",
     "АТОН", "investfunds", "10903", None, "ofz", "ИПИФ", "competitor"),
    ("comp_alfa_ofzturbo", "Альфа-Капитал ОФЗ Смарт Турбо", "Альфа ОФЗ Смарт Турбо",
     "Альфа-Капитал", "investfunds", "10567", None, "ofz", "ИПИФ", "competitor"),
    # ─── MOEX ISS (БПИФ/ИПИФ, exchange price) ───
    ("comp_tcap_bonds", "Т-Капитал Облигации", "Т-Капитал Облигации",
     "Т-Капитал (Т-Банк)", "moex", "TBRU", "TQTF", "corp_rub", "БПИФ", "competitor"),
    ("comp_alfa_managed", "Альфа-Капитал Управляемые облигации", "Альфа Управляемые облигации",
     "Альфа-Капитал", "moex", "AKMB", "TQTF", "corp_rub", "БПИФ", "competitor"),
    ("comp_aton_longofz", "АТОН Длинные ОФЗ", "АТОН Длинные ОФЗ",
     "АТОН", "moex", "AMGB", "TQTF", "ofz", "БПИФ", "competitor"),
    ("comp_vim_2xofz", "ВИМ 2х ОФЗ", "ВИМ 2х ОФЗ",
     "ВИМ Инвестиции (ВТБ)", "moex", "RU000A108ZB2", "TQIF", "ofz", "ИПИФ", "competitor"),
    # ─── benchmark index ───
    ("bench_rgbitr", "Индекс гособлигаций РФ (RGBITR)", "RGBITR",
     "Московская биржа", "moex", "RGBITR", "index", "ofz", "Индекс", "benchmark"),
]


def _row(t: tuple) -> dict[str, Any]:
    key, name, short_name, provider, source, source_ref, board, peer, ctype, kind = t
    return {
        "key": key,
        "name": name,
        "short_name": short_name,
        "native_currency": "RUB",
        "benchmark": "",
        "benchmark_label": "",
        "category": "bonds",
        "contract_type": ctype,
        "kind": kind,
        "provider": provider,
        "source": source,
        "source_ref": source_ref,
        "source_board": board,
        "peer_group": peer,
        "is_active": True,
    }


async def upsert(session: AsyncSession) -> tuple[int, int]:
    inserted = updated = 0
    for t in COMPETITORS:
        row = _row(t)
        existing = await session.scalar(select(Fund).where(Fund.key == row["key"]))
        if existing is None:
            session.add(Fund(**row))
            inserted += 1
        else:
            for k, v in row.items():
                if k == "key":
                    continue
                setattr(existing, k, v)
            updated += 1
    await session.commit()
    return inserted, updated


async def main() -> None:
    do_sync = "--sync" in sys.argv
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        ins, upd = await upsert(s)
        print(f"seed_competitors: inserted={ins} updated={upd}")
        if do_sync:
            print("syncing NAV series from sources (full backfill)…")
            res = await sync_all_competitors(s, full=True)
            for k, n in res.items():
                print(f"  {k}: {'ERROR' if n < 0 else f'+{n} quotes'}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
