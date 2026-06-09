import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Strategy(Base):
    __tablename__ = "strategies"
    __table_args__ = (UniqueConstraint("code"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str]  # e.g. "cons-rub6040" | "agg-equal" | "base"
    name: Mapped[str]
    risk_profile: Mapped[str]  # base | cons | agg
    ccy_strategy: Mapped[str]  # rub6040 | equal | val6040 | none (for base)

    description: Mapped[str | None] = mapped_column(nullable=True)
    composition: Mapped[dict[str, float]] = mapped_column(JSONB)  # {fund_key: weight%}

    inception_date: Mapped[date | None] = mapped_column(nullable=True)

    target_yield: Mapped[str | None] = mapped_column(nullable=True)
    horizon: Mapped[str | None] = mapped_column(nullable=True)
    min_check: Mapped[str | None] = mapped_column(nullable=True)
    rebalance_period: Mapped[str | None] = mapped_column(nullable=True)

    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(nullable=True, onupdate=func.now())
