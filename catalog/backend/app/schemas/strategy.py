"""Pydantic schemas for Strategy catalog endpoints."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class StrategyBase(BaseModel):
    name: str | None = None
    risk_profile: str | None = None
    ccy_strategy: str | None = None
    description: str | None = None
    composition: dict[str, float] | None = None
    inception_date: date | None = None
    target_yield: str | None = None
    horizon: str | None = None
    min_check: str | None = None
    rebalance_period: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class StrategyCreate(StrategyBase):
    code: str
    name: str  # type: ignore[assignment]
    risk_profile: str  # type: ignore[assignment]
    ccy_strategy: str  # type: ignore[assignment]
    composition: dict[str, float]  # type: ignore[assignment]


class StrategyUpdate(StrategyBase):
    """code immutable — not present here."""


class StrategyOut(StrategyBase):
    model_config = ConfigDict(from_attributes=True)

    code: str
