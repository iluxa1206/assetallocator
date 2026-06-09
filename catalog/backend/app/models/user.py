from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.proposal import Proposal


class Role(str, Enum):
    ANALYST = "analyst"
    SALES = "sales"
    MANAGER = "manager"


class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"

    full_name: Mapped[str] = mapped_column(default="")
    role: Mapped[Role] = mapped_column(default=Role.SALES)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(onupdate=func.now(), nullable=True)

    clients: Mapped[list["Client"]] = relationship(back_populates="owner")
    proposals: Mapped[list["Proposal"]] = relationship(back_populates="owner")
