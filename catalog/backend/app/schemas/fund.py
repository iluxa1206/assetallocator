"""Pydantic schemas for Fund catalog endpoints."""

from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict


class FundBase(BaseModel):
    """Mutable fields — shared between Create and Update."""

    name: str | None = None
    short_name: str | None = None
    category: str | None = None
    contract_type: str | None = None
    native_currency: str | None = None
    benchmark: str | None = None
    benchmark_label: str | None = None
    isin: str | None = None
    ticker: str | None = None
    inception_date: date | None = None
    fund_rules_no: str | None = None

    aum: float | None = None
    aum_currency: str | None = None
    aum_as_of: date | None = None

    manager_name: str | None = None
    manager_bio: str | None = None

    target_yield: str | None = None
    horizon: str | None = None
    risk_score: int | None = None
    liquidity_label: str | None = None
    interval_label: str | None = None

    investor_type_fl: str | None = None
    investor_type_ul: str | None = None
    min_check: str | None = None
    logistics: str | None = None

    strategy_goal: str | None = None
    description: str | None = None
    why_bullets: list[str] | None = None

    mgmt_fee_tiers: list[dict[str, Any]] | None = None
    redemption_discount_y1: float | None = None
    redemption_discount_y2: float | None = None
    extra_expenses: str | None = None
    hwm: bool | None = None

    risks: list[dict[str, Any]] | None = None
    top_positions: list[dict[str, Any]] | None = None
    top_positions_as_of: date | None = None

    documents: list[dict[str, Any]] | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class FundCreate(FundBase):
    """Required: key (immutable PK), name, native_currency, benchmark.

    Other fields optional (NULLable in DB).
    """

    key: str
    name: str  # type: ignore[assignment]
    native_currency: str  # type: ignore[assignment]
    benchmark: str  # type: ignore[assignment]


class FundUpdate(FundBase):
    """All fields optional. `key` is immutable — not present here."""


class FundOut(FundBase):
    """Read response — includes immutable `key`."""

    model_config = ConfigDict(from_attributes=True)

    key: str
