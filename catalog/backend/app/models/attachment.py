import uuid
from datetime import datetime

from sqlalchemy import UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Attachment(Base):
    """Uploaded file bound to a fund or strategy card (product presentation PDF).

    Files live on disk under settings.attachments_dir as `stored_name`; the row keeps
    the original filename for the Content-Disposition header. One attachment per
    (entity_type, entity_id, kind) — re-upload replaces it.
    """

    __tablename__ = "attachments"
    __table_args__ = (UniqueConstraint("entity_type", "entity_id", "kind"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str]  # "fund" | "strategy"
    entity_id: Mapped[str]  # fund key or strategy code
    kind: Mapped[str] = mapped_column(default="presentation")
    filename: Mapped[str]
    stored_name: Mapped[str] = mapped_column(unique=True)
    content_type: Mapped[str] = mapped_column(default="application/pdf")
    size: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
