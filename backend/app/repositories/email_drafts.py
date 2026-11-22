from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, update

from app.domain.enums import DraftStatus
from app.models.email_draft import EmailDraft

from .base import Repository


class EmailDraftRepository(Repository):
    async def list_all(self) -> list[EmailDraft]:
        stmt = select(EmailDraft).order_by(EmailDraft.created_at.desc())
        return list(await self.session.scalars(stmt))

    async def get(self, draft_id: UUID) -> EmailDraft | None:
        return await self.session.get(EmailDraft, draft_id)

    async def delete(self, draft: EmailDraft) -> None:
        await self.session.delete(draft)

    async def claim_due(self) -> list[EmailDraft]:
        """Atomically move every due scheduled draft to processing, so no draft is sent twice."""
        result = await self.session.execute(
            update(EmailDraft)
            .where(
                EmailDraft.status == DraftStatus.scheduled,
                EmailDraft.scheduled_at <= func.now(),
            )
            .values(status=DraftStatus.processing)
            .returning(EmailDraft)
        )
        return list(result.scalars().all())
