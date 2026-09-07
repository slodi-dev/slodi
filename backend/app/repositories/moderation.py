from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import ScalarSelect, Select, String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.domain.enums import ReportStatus, ReviewState
from app.models.content import Content
from app.models.content_report import ContentReport

from .base import Repository


def open_report_reasons_subq() -> ScalarSelect[Any]:
    """The distinct reasons people gave, as an array.

    A count alone tells a reviewer that something is wrong but not what, so they
    have to cross-reference the reports tab for every flagged row. In a sweep of
    fifty that is the difference between minutes and an afternoon.
    """
    return (
        # Cast to text before aggregating: psycopg hands back an array of a
        # custom enum type as one raw string, which then parses as a string
        # rather than a list.
        select(func.array_agg(func.distinct(cast(ContentReport.reason, String))))
        .where(
            ContentReport.content_id == Content.id,
            ContentReport.status == ReportStatus.open,
        )
        .correlate(Content)
        .scalar_subquery()
    )


def author_strikes_subq() -> ScalarSelect[int]:
    """How much of this author's work a moderator has already acted against.

    Derived here rather than stored, so un-hiding something takes its strike
    with it. Lets a reviewer tell a first-time contributor from a repeat one
    without leaving the queue.
    """
    author = aliased(Content)
    return (
        select(func.count())
        .select_from(author)
        .where(
            author.author_id == Content.author_id,
            author.deleted_at.is_(None),
            (author.hidden_at.is_not(None)) | (author.review_state == ReviewState.rejected),
        )
        .correlate(Content)
        .scalar_subquery()
    )


def open_report_count_subq() -> ScalarSelect[int]:
    """Open reports against a piece of content, as a correlated scalar."""
    return (
        select(func.count(ContentReport.id))
        .where(
            ContentReport.content_id == Content.id,
            ContentReport.status == ReportStatus.open,
        )
        .correlate(Content)
        .scalar_subquery()
    )


class ModerationRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    def _queue_stmt(self) -> Select:
        """Everything nobody has looked at yet, oldest first.

        Oldest first because the queue is a backlog, not a feed: the thing that
        has waited longest is the thing most overdue. Newest-first would let old
        submissions sink forever under a steady trickle of new ones.
        """
        return (
            select(
                Content,
                open_report_count_subq(),
                open_report_reasons_subq(),
                author_strikes_subq(),
            )
            .options(selectinload(Content.author))
            .where(
                Content.review_state == ReviewState.unreviewed,
                Content.deleted_at.is_(None),
            )
            .order_by(Content.created_at)
        )

    async def list_unreviewed(
        self, limit: int, offset: int
    ) -> list[tuple[Content, int, list[str], int]]:
        rows = await self.session.execute(self._queue_stmt().limit(limit).offset(offset))
        return [
            (c, int(n), list(reasons or []), int(strikes)) for c, n, reasons, strikes in rows.all()
        ]

    async def count_unreviewed(self) -> int:
        return (
            await self.session.scalar(
                select(func.count())
                .select_from(Content)
                .where(
                    Content.review_state == ReviewState.unreviewed,
                    Content.deleted_at.is_(None),
                )
            )
        ) or 0

    async def get(self, content_id: UUID) -> Content | None:
        """Reaches hidden content on purpose — the board is where it is undone."""
        return await self.session.scalar(
            select(Content)
            .options(selectinload(Content.author))
            .where(Content.id == content_id, Content.deleted_at.is_(None))
        )

    async def count_strikes(self, author_id: UUID) -> int:
        """Content of this author's that a moderator acted against.

        Derived, never a stored counter: a moderator who un-hides something must
        see the strike go with it, and an integer column drifts the first time
        somebody changes their mind.
        """
        return (
            await self.session.scalar(
                select(func.count())
                .select_from(Content)
                .where(
                    Content.author_id == author_id,
                    Content.deleted_at.is_(None),
                    (Content.hidden_at.is_not(None))
                    | (Content.review_state == ReviewState.rejected),
                )
            )
        ) or 0
