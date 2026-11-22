from __future__ import annotations

import asyncio
import datetime as dt
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session_maker
from app.core.email import OutgoingEmail, send_batch
from app.domain.enums import DraftStatus
from app.models.email_draft import EmailDraft
from app.repositories.email_drafts import EmailDraftRepository
from app.schemas.email import DraftCreate, DraftOut, DraftUpdate
from app.services.email_delivery import build_test_message, draft_messages

logger = logging.getLogger(__name__)


class EmailDraftService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = EmailDraftRepository(session)

    async def list(self) -> list[DraftOut]:
        return [DraftOut.model_validate(d) for d in await self.repo.list_all()]

    async def get(self, draft_id: UUID) -> EmailDraft:
        draft = await self.repo.get(draft_id)
        if draft is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
        return draft

    async def create(self, data: DraftCreate, created_by: UUID) -> DraftOut:
        draft = EmailDraft(**data.model_dump(), status=DraftStatus.draft, created_by=created_by)
        await self.repo.add(draft)
        return await self._save(draft)

    async def update(self, draft_id: UUID, data: DraftUpdate) -> DraftOut:
        draft = await self.get(draft_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(draft, field, value)
        return await self._save(draft)

    async def delete(self, draft_id: UUID) -> None:
        draft = await self.get(draft_id)
        if draft.status not in (DraftStatus.draft, DraftStatus.failed):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete draft with status '{draft.status}'",
            )
        await self.repo.delete(draft)
        await self.session.commit()

    async def start_sending(self, draft_id: UUID) -> DraftOut:
        """Mark a draft as processing; the caller then sends it with `send_draft_by_id`."""
        draft = await self.get(draft_id)
        if draft.status not in (DraftStatus.draft, DraftStatus.scheduled):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot send draft with status '{draft.status}'",
            )
        draft.status = DraftStatus.processing
        return await self._save(draft)

    async def test_message(self, draft_id: UUID, recipient: str) -> OutgoingEmail:
        return await build_test_message(self.session, await self.get(draft_id), recipient)

    async def _save(self, draft: EmailDraft) -> DraftOut:
        await self.session.commit()
        await self.session.refresh(draft)
        return DraftOut.model_validate(draft)


async def send_draft(draft: EmailDraft, session: AsyncSession) -> None:
    """Render and send a processing draft, then mark it sent or failed."""
    try:
        messages = await draft_messages(session, draft)
        if messages:
            # The Resend SDK blocks, so it runs off the event loop.
            await asyncio.get_running_loop().run_in_executor(None, send_batch, messages)
        draft.status = DraftStatus.sent
        draft.sent_at = dt.datetime.now(dt.timezone.utc)
        logger.info("Draft %s sent (%d recipients)", draft.id, len(messages))
    except Exception:
        logger.exception("Failed to send draft %s", draft.id)
        draft.status = DraftStatus.failed
    await session.commit()


async def send_draft_by_id(draft_id: UUID) -> None:
    """`send_draft` with its own session, for a background task after the request has ended."""
    async with get_session_maker()() as session:
        draft = await session.get(EmailDraft, draft_id)
        if draft is not None:
            await send_draft(draft, session)
