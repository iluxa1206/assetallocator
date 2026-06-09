import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.user import User


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))

    title: Mapped[str] = mapped_column(default="")
    comment: Mapped[str] = mapped_column(default="")

    amount: Mapped[float]
    amount_currency: Mapped[str]  # RUB | USD | CNY
    base_currency: Mapped[str]  # RUB | USD | CNY
    risk_profile: Mapped[str]   # base | cons | agg
    currency_strategy: Mapped[str]  # rub6040 | equal | val6040

    fund_weights: Mapped[dict[str, Any]] = mapped_column(JSONB)
    index_weights: Mapped[dict[str, Any]] = mapped_column(JSONB)

    proposal_date: Mapped[date]
    sent_to_client: Mapped[bool] = mapped_column(default=False)
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(onupdate=func.now(), nullable=True)

    owner: Mapped["User"] = relationship(back_populates="proposals")
    client: Mapped["Client"] = relationship(back_populates="proposals")
