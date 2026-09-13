from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_email_background
from app.domain.enums import ReportStatus, ReviewCommentVisibility, ReviewState
from app.models.content import Content
from app.models.review_comment import ReviewComment
from app.repositories.moderation import ModerationRepository
from app.schemas.moderation import (
    Attachment,
    HideDecision,
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
        return await self.repo.count_unreviewed()

    async def detail(self, content_id: UUID) -> ReviewDetail:
        """One item in full, for the reading pane.

        Includes the objections against it, so judging a flagged item does not
        mean holding two screens open at once.
        """
        row = await self.repo.get_detail(content_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        content, reviewer = row
        return ReviewDetail.model_validate(content).model_copy(
            update={
                "reviewed_by_name": reviewer,
                "tags": [ct.tag.name for ct in content.content_tags],
                "reports": [
                    ReportSummary.model_validate(r)
                    for r in content.reports
                    if r.status == ReportStatus.open
                ],
                "review_comments": await self.comments(content_id),
                "documents": _documents_from(content.media),
                "open_report_count": sum(
                    1 for r in content.reports if r.status == ReportStatus.open
                ),
                "author_strikes": await self.strikes_for_author(content.author_id),
                "author_reports_received": await self.reports_against_author(content.author_id),
                "author_suspension_count": await self.repo.count_suspensions(content.author_id),
                "author_suspended_until": await self.repo.active_suspension_end(
                    content.author_id, get_current_datetime()
                ),
            }
        )

    async def reports_against_author(self, author_id: UUID) -> int:
        """Reports filed against anything this person wrote, dismissed ones
        included. **Context, not evidence** — anyone can report anyone, so this
        must never read as guilt on its own."""
        return await self.repo.count_reports_against_author(author_id)

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

    async def comments(self, content_id: UUID) -> list[ReviewCommentOut]:
        return [
            ReviewCommentOut.model_validate(c).model_copy(
                update={"author_name": c.author.name if c.author else None}
            )
            for c in await self.repo.list_comments(content_id)
        ]

    async def add_comment(
        self,
        content_id: UUID,
        reviewer_id: UUID,
        data: ReviewCommentCreate,
        background_tasks: BackgroundTasks,
    ) -> ReviewCommentOut:
        """Leave a note — kept between the team, or sent to the author.

        A `to_author` note is emailed, because a suggestion nobody is told about
        is not a suggestion. An `internal` one is not, and must never be: the
        two are separate values precisely so this branch can be explicit rather
        than a truthy check on some flag.
        """
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
            self._send_to_author(background_tasks, content, data.body)

        return (await self.comments(content_id))[-1]

    def _send_to_author(
        self, background_tasks: BackgroundTasks, content: Content, body: str
    ) -> None:
        recipient = content.author.email if content.author else None
        if not recipient:
            logger.error(
                "Suggestion on content %s could not be sent — the author has no address",
                content.id,
            )
            return
        send_email_background(
            background_tasks,
            [recipient],
            f"Slóði — ábending um „{content.name}“",
            (
                f"<p>Dagskrárstjórnarteymið skildi eftir ábendingu um efnið þitt "
                f"<strong>{content.name}</strong>:</p>"
                f"<blockquote>{body}</blockquote>"
                f"<p>Þú getur lagað efnið í dagskrárbankanum þegar þér hentar.</p>"
            ),
        )

    def _notify_author(
        self,
        background_tasks: BackgroundTasks,
        content: Content,
        subject: str,
        body_html: str,
    ) -> None:
        """Tell the author what happened to their submission.

        Moderation a leader is not told about is indistinguishable from their
        work quietly disappearing, which is the single most likely thing to
        turn into a support message once the bank is open.
        """
        recipient = content.author.email if content.author else None
        if not recipient:
            logger.error(
                "Decision on content %s could not be sent — the author has no address",
                content.id,
            )
            return
        send_email_background(background_tasks, [recipient], subject, body_html)

    async def review(
        self,
        content_id: UUID,
        reviewer_id: UUID,
        decision: ReviewDecision,
        background_tasks: BackgroundTasks | None = None,
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

        # Approval sends nothing. Silence is the right answer to "nothing was
        # wrong", and a mail per approved item trains people to ignore the ones
        # that matter.
        if background_tasks is not None and decision.review_state == ReviewState.rejected:
            self._notify_author(
                background_tasks,
                content,
                f"Slóði — efnið þitt „{content.name}“ var ekki samþykkt",
                (
                    f"<p>Dagskrárstjórnarteymið fór yfir efnið þitt "
                    f"<strong>{content.name}</strong> og samþykkti það ekki.</p>"
                    f"<blockquote>{decision.note}</blockquote>"
                    f"<p>Þú getur lagað efnið í dagskrárbankanum og sent það aftur. "
                    f"Ef eitthvað er óljóst máttu hafa samband við teymið.</p>"
                ),
            )

        return await self._reload(content_id)

    async def set_hidden(
        self,
        content_id: UUID,
        reviewer_id: UUID,
        decision: HideDecision,
        background_tasks: BackgroundTasks | None = None,
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

        # Only on hiding. Putting something back is good news the author will
        # see for themselves the moment they look.
        if background_tasks is not None and decision.hidden:
            reason = (
                f"<blockquote>{decision.note}</blockquote>"
                if decision.note
                else "<p>Engin skýring fylgdi.</p>"
            )
            self._notify_author(
                background_tasks,
                content,
                f"Slóði — efnið þitt „{content.name}“ er ekki lengur í bankanum",
                (
                    f"<p>Dagskrárstjórnarteymið tók efnið þitt "
                    f"<strong>{content.name}</strong> úr dagskrárbankanum.</p>"
                    f"{reason}"
                    f"<p>Hafðu samband við teymið ef þú vilt ræða það.</p>"
                ),
            )

        return await self._reload(content_id)


def _documents_from(media: dict[str, Any] | None) -> list[Attachment]:
    """Attachments, read defensively out of free-form JSONB.

    `Content.media` has no schema and nothing writes it yet — attachments are
    sc-404. Anything under `documents` that does not match `Attachment` is
    skipped rather than raising: a malformed entry should cost the pane one
    file, not the whole item a reviewer is trying to judge.
    """
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
