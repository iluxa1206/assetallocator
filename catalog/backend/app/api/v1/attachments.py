"""Presentation-PDF attachments on fund and strategy cards.

Admin uploads/replaces/deletes; any authenticated user downloads (logged to the
activity audit). Managers can only reach attachments of own-kind funds — competitor
funds are hidden from them entirely.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.users import current_active_user, current_superuser, is_restricted
from app.db.session import get_async_session
from app.models.attachment import Attachment
from app.models.audit_event import AuditEvent
from app.models.fund import Fund
from app.models.strategy import Strategy
from app.models.user import User

router = APIRouter(prefix="/attachments", tags=["attachments"])

ENTITY_TYPES = ("fund", "strategy", "general")
MAX_SIZE = 50 * 1024 * 1024  # 50 MB

# Company-wide presentation decks — not tied to a single fund/strategy. The
# entity_id is one of these fixed slugs; the download block lives on /catalog.
GENERAL_IDS = ("overview", "overview-idx", "results", "vs-index")


def _storage_dir() -> Path:
    d = Path(settings.attachments_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


async def _check_entity(entity_type: str, entity_id: str, session: AsyncSession, user: User) -> None:
    """404 when the entity doesn't exist or is hidden from this user."""
    if entity_type == "fund":
        fund = await session.get(Fund, entity_id)
        if fund is None or (is_restricted(user) and fund.kind != "own"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Fund not found")
    elif entity_type == "strategy":
        strategy = await session.scalar(select(Strategy).where(Strategy.code == entity_id))
        if strategy is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Strategy not found")
    elif entity_type == "general":
        if entity_id not in GENERAL_IDS:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown presentation")
    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown entity type")


async def _get_attachment(entity_type: str, entity_id: str, session: AsyncSession) -> Attachment | None:
    return await session.scalar(
        select(Attachment).where(
            Attachment.entity_type == entity_type,
            Attachment.entity_id == entity_id,
            Attachment.kind == "presentation",
        )
    )


class AttachmentOut(BaseModel):
    id: uuid.UUID
    filename: str
    size: int
    created_at: str

    model_config = {"from_attributes": False}


def _out(a: Attachment) -> AttachmentOut:
    return AttachmentOut(id=a.id, filename=a.filename, size=a.size, created_at=a.created_at.isoformat())


@router.get("/{entity_type}/{entity_id}", response_model=AttachmentOut)
async def attachment_info(
    entity_type: str,
    entity_id: str,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
) -> AttachmentOut:
    await _check_entity(entity_type, entity_id, session, user)
    att = await _get_attachment(entity_type, entity_id, session)
    if att is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No attachment")
    return _out(att)


@router.get("/{entity_type}/{entity_id}/download")
async def download_attachment(
    entity_type: str,
    entity_id: str,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
) -> FileResponse:
    await _check_entity(entity_type, entity_id, session, user)
    att = await _get_attachment(entity_type, entity_id, session)
    if att is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No attachment")
    path = _storage_dir() / att.stored_name
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File missing on disk")

    session.add(AuditEvent(
        user_id=user.id,
        action="file.download",
        payload={"file": att.filename, "entity_type": entity_type, "entity_id": entity_id},
    ))
    await session.commit()

    return FileResponse(path, media_type=att.content_type, filename=att.filename)


@router.put("/{entity_type}/{entity_id}", response_model=AttachmentOut)
async def upload_attachment(
    entity_type: str,
    entity_id: str,
    file: UploadFile,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
) -> AttachmentOut:
    await _check_entity(entity_type, entity_id, session, admin)
    if file.content_type != "application/pdf":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Только PDF-файлы")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Файл больше 50 МБ")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Файл не похож на PDF")

    stored_name = f"{uuid.uuid4().hex}.pdf"
    (_storage_dir() / stored_name).write_bytes(content)

    att = await _get_attachment(entity_type, entity_id, session)
    if att is not None:
        (_storage_dir() / att.stored_name).unlink(missing_ok=True)
        att.filename = file.filename or "presentation.pdf"
        att.stored_name = stored_name
        att.size = len(content)
    else:
        att = Attachment(
            entity_type=entity_type,
            entity_id=entity_id,
            filename=file.filename or "presentation.pdf",
            stored_name=stored_name,
            size=len(content),
        )
        session.add(att)
    await session.commit()
    await session.refresh(att)
    return _out(att)


@router.delete("/{entity_type}/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    entity_type: str,
    entity_id: str,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_superuser),
) -> None:
    att = await _get_attachment(entity_type, entity_id, session)
    if att is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No attachment")
    (_storage_dir() / att.stored_name).unlink(missing_ok=True)
    await session.delete(att)
    await session.commit()
