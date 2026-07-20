"""Invitation-based onboarding: the public half of the flow.

Public register is disabled (see api/v1/auth.py) — the only way to get an account is
an admin-created invitation link (frontend /invite/{token}). An invitation whose email
already has an account acts as a password-reset link: accept updates the password
instead of creating a user. Admin CRUD for invitations lives in api/v1/admin.py.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_users.exceptions import InvalidPasswordException, UserAlreadyExists
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import UserManager, get_user_manager
from app.db.session import get_async_session
from app.models.invitation import Invitation
from app.models.user import User
from app.schemas.user import UserCreate

router = APIRouter(prefix="/auth/invitations", tags=["invitations"])


class InvitationInfo(BaseModel):
    email: str
    is_reset: bool  # True → the email already has an account, accept = set new password


class InvitationAccept(BaseModel):
    full_name: str = ""
    password: str


async def _valid_invitation(token: str, session: AsyncSession) -> Invitation:
    inv = await session.scalar(select(Invitation).where(Invitation.token == token))
    if inv is None or inv.used:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Приглашение не найдено или уже использовано")
    if inv.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_410_GONE, "Срок действия приглашения истёк")
    return inv


@router.get("/{token}", response_model=InvitationInfo)
async def invitation_info(
    token: str,
    session: AsyncSession = Depends(get_async_session),
) -> InvitationInfo:
    """Public check used by the /invite/{token} page to show the email + mode."""
    inv = await _valid_invitation(token, session)
    user = await session.scalar(select(User).where(User.email == inv.email))
    return InvitationInfo(email=inv.email, is_reset=user is not None)


@router.post("/{token}/accept", status_code=status.HTTP_201_CREATED)
async def accept_invitation(
    token: str,
    payload: InvitationAccept,
    session: AsyncSession = Depends(get_async_session),
    user_manager: UserManager = Depends(get_user_manager),
) -> dict[str, str]:
    inv = await _valid_invitation(token, session)
    existing = await session.scalar(select(User).where(User.email == inv.email))

    try:
        if existing is not None:
            # Admin-issued password reset: same link flow, but the account already exists.
            await user_manager.validate_password(payload.password, existing)
            existing.hashed_password = user_manager.password_helper.hash(payload.password)
            if payload.full_name:
                existing.full_name = payload.full_name
            session.add(existing)
        else:
            await user_manager.create(
                UserCreate(
                    email=inv.email,
                    password=payload.password,
                    full_name=payload.full_name,
                    role=inv.role,
                ),
                safe=True,
            )
    except InvalidPasswordException as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e.reason)) from e
    except UserAlreadyExists as e:  # race: user appeared between the two queries
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь уже существует") from e

    inv.used = True
    session.add(inv)
    await session.commit()
    return {"email": inv.email}
