from datetime import date, datetime
from typing import Any

from sqlalchemy import ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Fund(Base):
    __tablename__ = "funds"

    key: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    native_currency: Mapped[str]
    benchmark: Mapped[str]
    benchmark_label: Mapped[str] = mapped_column(default="")
    is_active: Mapped[bool] = mapped_column(default=True)

    short_name: Mapped[str | None] = mapped_column(nullable=True)
    category: Mapped[str | None] = mapped_column(nullable=True)
    contract_type: Mapped[str | None] = mapped_column(nullable=True)
    isin: Mapped[str | None] = mapped_column(nullable=True)
    ticker: Mapped[str | None] = mapped_column(nullable=True)
    inception_date: Mapped[date | None] = mapped_column(nullable=True)
    fund_rules_no: Mapped[str | None] = mapped_column(nullable=True)

    aum: Mapped[float | None] = mapped_column(nullable=True)
    aum_currency: Mapped[str | None] = mapped_column(nullable=True)
    aum_as_of: Mapped[date | None] = mapped_column(nullable=True)

    manager_name: Mapped[str | None] = mapped_column(nullable=True)
    manager_bio: Mapped[str | None] = mapped_column(nullable=True)

    target_yield: Mapped[str | None] = mapped_column(nullable=True)
    horizon: Mapped[str | None] = mapped_column(nullable=True)
    risk_score: Mapped[int | None] = mapped_column(nullable=True)
    liquidity_label: Mapped[str | None] = mapped_column(nullable=True)
    interval_label: Mapped[str | None] = mapped_column(nullable=True)

    investor_type_fl: Mapped[str | None] = mapped_column(nullable=True)
    investor_type_ul: Mapped[str | None] = mapped_column(nullable=True)
    min_check: Mapped[str | None] = mapped_column(nullable=True)
    logistics: Mapped[str | None] = mapped_column(nullable=True)

    strategy_goal: Mapped[str | None] = mapped_column(nullable=True)
    description: Mapped[str | None] = mapped_column(nullable=True)
    why_bullets: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    mgmt_fee_tiers: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    redemption_discount_y1: Mapped[float | None] = mapped_column(nullable=True)
    redemption_discount_y2: Mapped[float | None] = mapped_column(nullable=True)
    extra_expenses: Mapped[str | None] = mapped_column(nullable=True)
    hwm: Mapped[bool] = mapped_column(default=False)

    risks: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    top_positions: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    top_positions_as_of: Mapped[date | None] = mapped_column(nullable=True)

    documents: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0)

    quotes: Mapped[list["FundQuote"]] = relationship(back_populates="fund")


class FundQuote(Base):
    """Backtest NAV series — long extended history used by the dashboard portfolio engine.

    Read by `app/services/portfolio_service.py` via `app/calculations/series.py`.
    NOT written by the catalog UI — see `FundCatalogQuote` for the editable copy.
    """

    __tablename__ = "fund_quotes"
    __table_args__ = (UniqueConstraint("fund_key", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fund_key: Mapped[str] = mapped_column(ForeignKey("funds.key", ondelete="CASCADE"))
    date: Mapped[date]
    price_rub: Mapped[float]
    price_native: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    fund: Mapped["Fund"] = relationship(back_populates="quotes")


class FundCatalogQuote(Base):
    """Catalog NAV series — editable in the admin UI, used by `/funds/series`, `/performance`.

    Decoupled from `FundQuote` so catalog edits don't pollute the dashboard backtest.
    """

    __tablename__ = "fund_catalog_quotes"
    __table_args__ = (UniqueConstraint("fund_key", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fund_key: Mapped[str] = mapped_column(ForeignKey("funds.key", ondelete="CASCADE"))
    date: Mapped[date]
    price_rub: Mapped[float]
    price_native: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
