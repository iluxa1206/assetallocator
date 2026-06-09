"""Seed Strategy catalog from app.calculations.constants.ALLOCATIONS.

Idempotent: upsert by `code`.

Run:
    DATABASE_URL=postgresql+asyncpg://astra:astra_dev@localhost:5434/astra \
        .venv/bin/python -m scripts.seed_strategies
"""

from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.calculations.constants import ALLOCATIONS, CCY_STRATEGIES, RISK_PROFILES
from app.core.config import settings
from app.models.strategy import Strategy


def _ccy_label(ccy: str) -> str:
    return CCY_STRATEGIES[ccy]["name"] if ccy in CCY_STRATEGIES else ""


def _profile_desc(risk: str) -> str:
    return RISK_PROFILES[risk]["desc"]


def build_records() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    order = 0
    for risk_key, content in ALLOCATIONS.items():
        if risk_key == "base":
            # single portfolio, all funds 10%
            order += 10
            rows.append({
                "code": "base",
                "name": "Базовый — все фонды поровну",
                "risk_profile": "base",
                "ccy_strategy": "none",
                "description": (
                    "Эталонный портфель, в котором все 10 фондов представлены равными долями по 10%. "
                    "Используется как базовая точка отсчёта для оценки эффективности риск-профилей "
                    "и валютных стратегий."
                ),
                "composition": content,  # dict[str, int]
                "target_yield": None,
                "horizon": "От 2 лет",
                "min_check": "1 млн ₽",
                "rebalance_period": "Ежеквартально",
                "sort_order": order,
            })
            continue
        # risk profile × ccy strategy
        risk_name = RISK_PROFILES[risk_key]["name"]
        for ccy_key, comp in content.items():
            order += 10
            rows.append({
                "code": f"{risk_key}-{ccy_key}",
                "name": f"{risk_name} · {_ccy_label(ccy_key)}",
                "risk_profile": risk_key,
                "ccy_strategy": ccy_key,
                "description": (
                    f"{_profile_desc(risk_key)}. Валютная аллокация: {_ccy_label(ccy_key).lower()}. "
                    f"Композиция из 10 фондов Astra УА — взвешена по риск-профилю и валютному вектору."
                ),
                "composition": comp,
                "target_yield": None,
                "horizon": "От 3 лет" if risk_key == "agg" else "От 2 лет",
                "min_check": "1 млн ₽",
                "rebalance_period": "Ежеквартально",
                "sort_order": order,
            })
    return rows


async def upsert(session: AsyncSession, rows: list[dict[str, Any]]) -> tuple[int, int]:
    inserted = 0
    updated = 0
    for r in rows:
        existing = await session.scalar(select(Strategy).where(Strategy.code == r["code"]))
        if existing is None:
            session.add(Strategy(**r))
            inserted += 1
        else:
            for k, v in r.items():
                if k == "code":
                    continue
                setattr(existing, k, v)
            updated += 1
    await session.commit()
    return inserted, updated


async def main() -> None:
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        ins, upd = await upsert(s, build_records())
    await engine.dispose()
    print(f"seed_strategies: inserted={ins} updated={upd}")


if __name__ == "__main__":
    asyncio.run(main())
