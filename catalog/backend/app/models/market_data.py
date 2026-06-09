import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketDataPoint(Base):
    """One row per date: indices, FX rates, inflation."""

    __tablename__ = "market_data_points"

    date: Mapped[datetime.date] = mapped_column(primary_key=True)

    rusfar: Mapped[float | None] = mapped_column(nullable=True)
    rgbitr: Mapped[float | None] = mapped_column(nullable=True)
    mcftr: Mapped[float | None] = mapped_column(nullable=True)
    cbonds_zo_rub: Mapped[float | None] = mapped_column(nullable=True)
    cbonds_zo_usd: Mapped[float | None] = mapped_column(nullable=True)
    rucnytr_rub: Mapped[float | None] = mapped_column(nullable=True)
    rucnytr_cny: Mapped[float | None] = mapped_column(nullable=True)
    gldrub: Mapped[float | None] = mapped_column(nullable=True)
    usdrub: Mapped[float | None] = mapped_column(nullable=True)
    cnyrub: Mapped[float | None] = mapped_column(nullable=True)
    cpi_rub: Mapped[float | None] = mapped_column(nullable=True)   # YoY %
    cpi_usd: Mapped[float | None] = mapped_column(nullable=True)   # YoY %
    cpi_cny: Mapped[float | None] = mapped_column(nullable=True)   # YoY %

    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
