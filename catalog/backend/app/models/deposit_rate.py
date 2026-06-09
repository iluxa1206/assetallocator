"""CBR maximum deposit rate (top-10 banks, RUB) — published every 10 days."""

import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DepositRateMax10(Base):
    """Maximum RUB deposit rate of top-10 banks, source: cbr.ru/statistics/avgprocstav/.

    One row per published decade date. `rate` is annualized percent.
    """

    __tablename__ = "deposit_rates_max10"

    date: Mapped[datetime.date] = mapped_column(primary_key=True)
    rate: Mapped[float] = mapped_column(nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
