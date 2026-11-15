from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_email_background
from app.domain.enums import (
    HIDDEN_REVIEW_STATES,
    ReportStatus,
    ReviewCommentVisibility,
    ReviewState,
)
from app.models.content import Content
from app.models.review_comment import ReviewComment
from app.repositories.moderation import ModerationRepository
from app.repositories.posting_suspensions import PostingSuspensionRepository
from app.schemas.moderation import (
    Attachment,
    ReportSummary,
    ReviewCommentCreate,
    ReviewCommentOut,
    ReviewDecision,
    ReviewDetail,
    ReviewFilters,
    ReviewQueueItem,
)
from app.utils import get_current_datetime

logger = logging.getLogger(__name__)


class ModerationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ModerationRepository(session)

    async def queue(self, filters: ReviewFilters, limit: int, offset: int) -> list[ReviewQueueItem]:
        rows = await self.repo.list_queue(filters, limit, offset)
        return [
            ReviewQueueItem.model_validate(c).model_copy(
                update={
                    "open_report_count": count,
                    "open_report_reasons": reasons,
                    "author_strikes": strikes,
                    "reviewed_by_name": reviewer,
                }
            )
            for c, count, reasons, strikes, reviewer in rows
        ]

    async def count(self, filters: ReviewFilters) -> int:
        return await self.repo.count_queue(filters)

    async def count_unreviewed(self) -> int:
        return await self.repo.count_queue(ReviewFilters(review_state=ReviewState.unreviewed))

    async def detail(self, content_id: UUID) -> ReviewDetail:
        """One item in full for the reading pane, with the open reports against it."""
        row = await self.repo.get_detail(content_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        content, reviewer = row
        suspensions = PostingSuspensionRepository(self.session)
        active = await suspensions.active_for(content.author_id, get_current_datetime())
        reports = [
            ReportSummary.model_validate(r)
            for r in content.reports
            if r.status == ReportStatus.open and r.comment_id is None
        ]
        return ReviewDetail.model_validate(content).model_copy(
            update={
                "reviewed_by_name": reviewer,
                # Reports on comments are judged on their own pane.
                "reports": reports,
                "review_comments": [
                    _comment_out(c)
                    for c in sorted(content.review_comments, key=lambda c: c.created_at)
                ],
                "documents": _documents_from(content.media),
                "open_report_count": len(reports),
                "author_strikes": await self.strikes_for_author(content.author_id),
                "author_reports_received": await self.reports_against_author(content.author_id),
                "author_suspension_count": len(await suspensions.history_for(content.author_id)),
                "author_suspended_until": active.expires_at if active else None,
            }
        )

    async def reports_against_author(self, author_id: UUID) -> int:
        """Reports against anything this person wrote, dismissed ones included."""
        return await self.repo.count_reports_against_author(author_id)

    async def strikes_for_author(self, author_id: UUID) -> int:
        return await self.repo.count_strikes(author_id)

    async def _require(self, content_id: UUID) -> Content:
        content = await self.repo.get(content_id)
        if content is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        return content

    async def _reload(self, content_id: UUID) -> ReviewQueueItem:
        """Re-read via the repository; `session.refresh` leaves `author` unloaded (MissingGreenlet)."""
        return ReviewQueueItem.model_validate(await self._require(content_id))

    async def add_comment(
        self,
        content_id: UUID,
        reviewer_id: UUID,
        data: ReviewCommentCreate,
        background_tasks: BackgroundTasks,
    ) -> ReviewCommentOut:
        """Leave a note; a `to_author` note is emailed, an `internal` one never is."""
        content = await self._require(content_id)
        comment = ReviewComment(
            content_id=content_id,
            author_id=reviewer_id,
            body=data.body,
            visibility=data.visibility,
            created_at=get_current_datetime(),
        )
        self.session.add(comment)
        await self.session.commit()

        if data.visibility == ReviewCommentVisibility.to_author:
            _email_author(background_tasks, content, _SUGGESTION_EMAIL, data.body)

        return _comment_out((await self.repo.list_comments(content_id))[-1])

    async def review(
        self,
        content_id: UUID,
        reviewer_id: UUID,
        decision: ReviewDecision,
        background_tasks: BackgroundTasks,
    ) -> ReviewQueueItem:
        """Record a decision; `needs_changes` and `rejected` take the item out of the bank."""
        content = await self._require(content_id)
        state = ReviewState(decision.review_state)
        now = get_current_datetime()
        content.review_state = state
        content.review_note = decision.note
        content.reviewed_by_id = reviewer_id
        content.reviewed_at = now
        content.hidden_at = (content.hidden_at or now) if state in HIDDEN_REVIEW_STATES else None
        await self.session.commit()

        if state in _DECISION_EMAILS and decision.note:
            _email_author(background_tasks, content, _DECISION_EMAILS[state], decision.note)

        return await self._reload(content_id)


@dataclass(frozen=True)
class _AuthorEmail:
    subject: str
    intro: str
    outro: str


_SUGGESTION_EMAIL = _AuthorEmail(
    subject="Slóði — ábending um „{name}“",
    intro="Dagskrárstjórnarteymið skildi eftir ábendingu um efnið þitt <strong>{name}</strong>:",
    outro="Þú getur lagað efnið í dagskrárbankanum þegar þér hentar.",
)

_DECISION_EMAILS = {
    ReviewState.needs_changes: _AuthorEmail(
        subject="Slóði — efnið þitt „{name}“ þarfnast lagfæringar",
        intro=(
            "Dagskrárstjórnarteymið tók efnið þitt <strong>{name}</strong> úr "
            "dagskrárbankanum þar til það hefur verið lagað."
        ),
        outro="Þegar þú hefur lagað efnið fer það aftur í bankann og í yfirferð.",
    ),
    ReviewState.rejected: _AuthorEmail(
        subject="Slóði — efninu þínu „{name}“ var hafnað",
        intro=(
            "Dagskrárstjórnarteymið fór yfir efnið þitt <strong>{name}</strong> og hafnaði "
            "því. Það hefur verið tekið úr dagskrárbankanum."
        ),
        outro="Hafðu samband við teymið ef þú vilt ræða það.",
    ),
}


def _email_author(
    background_tasks: BackgroundTasks, content: Content, email: _AuthorEmail, note: str
) -> None:
    recipient = content.author.email if content.author else None
    if not recipient:
        logger.error("Email about content %s not sent — the author has no address", content.id)
        return
    name = html.escape(content.name)
    send_email_background(
        background_tasks,
        [recipient],
        email.subject.format(name=content.name),
        (
            f"<p>{email.intro.format(name=name)}</p>"
            f"<blockquote>{html.escape(note)}</blockquote>"
            f"<p>{email.outro}</p>"
        ),
    )


def _comment_out(comment: ReviewComment) -> ReviewCommentOut:
    return ReviewCommentOut.model_validate(comment).model_copy(
        update={"author_name": comment.author.name if comment.author else None}
    )


def _documents_from(media: dict[str, Any] | None) -> list[Attachment]:
    """Attachments from free-form JSONB; an unreadable entry is skipped, not raised."""
    if not isinstance(media, dict):
        return []
    entries = media.get("documents")
    if not isinstance(entries, list):
        return []
    out: list[Attachment] = []
    for entry in entries:
        try:
            out.append(Attachment.model_validate(entry))
        except ValidationError:
            logger.warning("Skipping unreadable attachment entry: %r", entry)
    return out
