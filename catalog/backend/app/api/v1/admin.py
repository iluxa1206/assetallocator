"""Superuser-only admin endpoints: employee list, invitation management.

The whole router requires an active superuser. Employee block/unblock and role
changes go through the fastapi-users router (PATCH /users/{id}); this module covers
what fastapi-users lacks: listing users and issuing invitation / password-reset links.
"""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import current_superuser
from app.db.session import get_async_session
from app.models.audit_event import AuditEvent
from app.models.invitation import Invitation
from app.models.user import Role, User

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(current_superuser)],
)

INVITE_TTL = timedelta(days=7)


# ──────────────── Users ────────────────


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    is_active: bool
    is_superuser: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(session: AsyncSession = Depends(get_async_session)) -> list[User]:
    return list((await session.scalars(select(User).order_by(User.created_at))).all())


# ──────────────── Invitations ────────────────


class InvitationCreate(BaseModel):
    email: str
    role: Role = Role.MANAGER


class InvitationOut(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    token: str
    expires_at: datetime
    created_at: datetime
    # pending | used | expired
    status: str
    # True → email already has an account, so the link works as a password reset
    is_reset: bool


def _invitation_out(inv: Invitation, existing_emails: set[str]) -> InvitationOut:
    if inv.used:
        st = "used"
    elif inv.expires_at < datetime.utcnow():
        st = "expired"
    else:
        st = "pending"
    return InvitationOut(
        id=inv.id,
        email=inv.email,
        role=inv.role,
        token=inv.token,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
        status=st,
        is_reset=inv.email in existing_emails,
    )


@router.get("/invitations", response_model=list[InvitationOut])
async def list_invitations(session: AsyncSession = Depends(get_async_session)) -> list[InvitationOut]:
    invs = list((await session.scalars(select(Invitation).order_by(Invitation.created_at.desc()))).all())
    emails = set((await session.scalars(select(User.email))).all())
    return [_invitation_out(i, emails) for i in invs]


@router.post("/invitations", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    payload: InvitationCreate,
    session: AsyncSession = Depends(get_async_session),
) -> InvitationOut:
    """New invitation for the email; a previous pending one is replaced.

    For an email that already has an account this issues a password-reset link
    (same /invite/{token} page on the frontend).
    """
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Некорректный email")

    # Replace any pending invitation for this email so only one link is live at a time.
    pending = (await session.scalars(
        select(Invitation).where(Invitation.email == email, Invitation.used.is_(False))
    )).all()
    for old in pending:
        await session.delete(old)

    inv = Invitation(
        email=email,
        role=payload.role,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() + INVITE_TTL,
    )
    session.add(inv)
    await session.commit()
    await session.refresh(inv)

    emails = set((await session.scalars(select(User.email).where(User.email == email))).all())
    return _invitation_out(inv, emails)


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> None:
    inv = await session.get(Invitation, invitation_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Приглашение не найдено")
    await session.delete(inv)
    await session.commit()


# ──────────────── Activity log ────────────────


class AuditEventOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None
    user_name: str | None
    action: str
    payload: dict[str, Any]
    created_at: datetime


class AuditPage(BaseModel):
    total: int
    events: list[AuditEventOut]


@router.get("/audit", response_model=AuditPage)
async def audit_log(
    user_id: uuid.UUID | None = None,
    action: str | None = Query(None, description="Exact action or prefix ending with '.'"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    session: AsyncSession = Depends(get_async_session),
) -> AuditPage:
    filters = []
    if user_id is not None:
        filters.append(AuditEvent.user_id == user_id)
    if action:
        filters.append(AuditEvent.action.startswith(action) if action.endswith(".") else AuditEvent.action == action)
    if date_from is not None:
        filters.append(AuditEvent.created_at >= date_from)
    if date_to is not None:
        filters.append(AuditEvent.created_at <= date_to)

    total = await session.scalar(select(func.count()).select_from(AuditEvent).where(*filters)) or 0
    rows = (await session.execute(
        select(AuditEvent, User.email, User.full_name)
        .outerjoin(User, AuditEvent.user_id == User.id)
        .where(*filters)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )).all()

    return AuditPage(
        total=total,
        events=[
            AuditEventOut(
                id=e.id,
                user_id=e.user_id,
                user_email=email,
                user_name=name,
                action=e.action,
                payload=e.payload,
                created_at=e.created_at,
            )
            for e, email, name in rows
        ],
    )
