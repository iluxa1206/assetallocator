"""Activity-audit beacon: authenticated frontend posts page-view events here.

Server-side events (logins, downloads) are written directly where they happen
(UserManager.on_after_login, download endpoints). The admin-facing log reader
lives in api/v1/admin.py.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import current_active_user
from app.db.session import get_async_session
from app.models.audit_event import AuditEvent
from app.models.user import User

router = APIRouter(prefix="/audit", tags=["audit"])

# Only navigation/export events may come from the client; auth/download events are
# written server-side so the client can't forge them.
CLIENT_ACTIONS = {"page.view", "export.png", "export.print", "export.copy"}


class AuditEventIn(BaseModel):
    action: str
    payload: dict[str, Any] = {}


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
async def record_event(
    event: AuditEventIn,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
) -> None:
    if event.action not in CLIENT_ACTIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown action")
    session.add(AuditEvent(user_id=user.id, action=event.action, payload=event.payload))
    await session.commit()
