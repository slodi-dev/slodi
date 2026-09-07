from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ReviewState
from app.models.content import Content
from app.repositories.moderation import ModerationRepository
from app.schemas.moderation import HideDecision, ReviewDecision, ReviewQueueItem
from app.utils import get_current_datetime


class ModerationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ModerationRepository(session)

    async def queue(self, limit: int, offset: int) -> list[ReviewQueueItem]:
        rows = await self.repo.list_unreviewed(limit, offset)
        return [
            ReviewQueueItem.model_validate(c).model_copy(
                update={
                    "open_report_count": count,
                    "open_report_reasons": reasons,
                    "author_strikes": strikes,
                }
            )
            for c, count, reasons, strikes in rows
        ]

    async def count_unreviewed(self) -> int:
        return await self.repo.count_unreviewed()

    async def strikes_for_author(self, author_id: UUID) -> int:
        return await self.repo.count_strikes(author_id)

    async def _require(self, content_id: UUID) -> Content:
        content = await self.repo.get(content_id)
        if content is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        return content

    async def _reload(self, content_id: UUID) -> ReviewQueueItem:
        """Re-read through the repository rather than refreshing in place.

        `ReviewQueueItem` carries `author_name`, which reaches through the author
        relationship. A plain `session.refresh` leaves that unloaded and the
        lazy load then raises MissingGreenlet under async.
        """
        return ReviewQueueItem.model_validate(await self._require(content_id))

    async def review(
        self, content_id: UUID, reviewer_id: UUID, decision: ReviewDecision
    ) -> ReviewQueueItem:
        """Record that the team has looked at this.

        **Reviewing does not change visibility.** Approving something already
        published changes nothing a leader can see, and rejecting does not remove
        it — hiding is a separate, deliberate act. Rejecting says "we looked and
        this is not right", which is what the author needs to hear; hiding says
        "and it should not be in the bank", which is a stronger claim and is not
        always the right one.
        """
        content = await self._require(content_id)
        content.review_state = decision.review_state
        content.review_note = decision.note
        content.reviewed_by_id = reviewer_id
        content.reviewed_at = get_current_datetime()
        await self.session.commit()
        return await self._reload(content_id)

    async def set_hidden(
        self, content_id: UUID, reviewer_id: UUID, decision: HideDecision
    ) -> ReviewQueueItem:
        """Take something out of the bank, or put it back.

        Un-hiding clears the timestamp rather than recording a second event, so
        an author's strike count — which counts hidden and rejected items —
        falls back on its own. That is the point of deriving it.
        """
        content = await self._require(content_id)
        content.hidden_at = get_current_datetime() if decision.hidden else None
        if decision.note:
            content.review_note = decision.note
        content.reviewed_by_id = reviewer_id
        content.reviewed_at = get_current_datetime()
        if decision.hidden and content.review_state == ReviewState.unreviewed:
            # Hiding is a review. Leaving it unreviewed would keep it in the
            # queue for someone else to look at and hide again.
            content.review_state = ReviewState.rejected
        await self.session.commit()
        return await self._reload(content_id)
