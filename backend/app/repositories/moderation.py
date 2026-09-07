from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from sqlalchemy import ScalarSelect, Select, String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.domain.enums import ReportStatus, ReviewState
from app.models.content import Content
from app.models.content_report import ContentReport
from app.models.posting_suspension import PostingSuspension
from app.models.review_comment import ReviewComment
from app.models.tag import ContentTag
from app.models.user import User
from app.schemas.moderation import ReviewFilters

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

    def _apply_filters(self, stmt: Select, filters: ReviewFilters) -> Select:
        """Every WHERE the board can ask for.

        Shared by the list and the count so the two can never disagree about
        what is being looked at.
        """
        stmt = stmt.where(Content.deleted_at.is_(None))

        if filters.review_state is not None:
            stmt = stmt.where(Content.review_state == filters.review_state)
        if filters.hidden is not None:
            stmt = stmt.where(
                Content.hidden_at.is_not(None) if filters.hidden else Content.hidden_at.is_(None)
            )
        if filters.content_type is not None:
            stmt = stmt.where(Content.content_type == filters.content_type)
        if filters.reported:
            # EXISTS rather than counting: it stops at the first match, and the
            # count is not needed to answer "is there one?".
            stmt = stmt.where(
                select(ContentReport.id)
                .where(
                    ContentReport.content_id == Content.id,
                    ContentReport.status == ReportStatus.open,
                )
                .exists()
            )
        if filters.author:
            stmt = stmt.where(
                Content.author_id.in_(
                    select(User.id).where(User.name.ilike(f"%{filters.author.strip()}%"))
                )
            )
        if filters.search:
            stmt = stmt.where(Content.name.ilike(f"%{filters.search.strip()}%"))

        # The column a view sorts by is the column its date filter means.
        # Filtering the record of decisions by submission date would answer a
        # question nobody asked: "what was decided in June?" is about June's
        # decisions, not June's submissions.
        date_col = (
            Content.created_at
            if filters.review_state == ReviewState.unreviewed
            else Content.reviewed_at
        )
        if filters.date_from:
            stmt = stmt.where(date_col >= filters.date_from)
        if filters.date_to:
            # Inclusive: a leader picking 30 June means the whole of that day,
            # not the instant it began.
            stmt = stmt.where(date_col < filters.date_to + dt.timedelta(days=1))

        return stmt

    def _queue_stmt(self, filters: ReviewFilters) -> Select:
        """The board's page.

        **Ordering follows what the list is for.** The unreviewed queue is a
        backlog, so it runs oldest-first: the thing that has waited longest is
        the most overdue, and newest-first would let old submissions sink under
        a trickle of new ones. Every other view is a record of what was done, so
        it runs most-recently-decided first.

        The three per-row subqueries are correlated, so they cost one lookup per
        row **returned** — a page, not the table. That is why the count below
        does not reuse this statement.
        """
        reviewer = aliased(User)
        stmt = (
            select(
                Content,
                open_report_count_subq(),
                open_report_reasons_subq(),
                author_strikes_subq(),
                reviewer.name,
            )
            .options(selectinload(Content.author))
            .join(reviewer, reviewer.id == Content.reviewed_by_id, isouter=True)
        )
        stmt = self._apply_filters(stmt, filters)

        if filters.review_state == ReviewState.unreviewed:
            return stmt.order_by(Content.created_at, Content.id)
        return stmt.order_by(
            Content.reviewed_at.desc().nullslast(), Content.created_at.desc(), Content.id
        )

    async def list_queue(
        self, filters: ReviewFilters, limit: int, offset: int
    ) -> list[tuple[Content, int, list[str], int, str | None]]:
        rows = await self.session.execute(self._queue_stmt(filters).limit(limit).offset(offset))
        return [
            (c, int(n), list(reasons or []), int(strikes), reviewer)
            for c, n, reasons, strikes, reviewer in rows.all()
        ]

    async def count_queue(self, filters: ReviewFilters) -> int:
        """How many match, without building a row for each.

        Deliberately does **not** reuse `_queue_stmt`: that carries three
        correlated subqueries and a join whose only purpose is filling a row.
        Counting through them would run all three per matching row — fine for a
        page of fifty, wasteful across ten thousand.
        """
        stmt = self._apply_filters(select(func.count()).select_from(Content), filters)
        return (await self.session.scalar(stmt)) or 0

    async def count_unreviewed(self) -> int:
        """The sidebar badge — how much is waiting, whatever the current view."""
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

    async def list_comments(self, content_id: UUID) -> list[ReviewComment]:
        """One item's reviewer notes, oldest first — a thread reads forwards."""
        stmt = (
            select(ReviewComment)
            .options(selectinload(ReviewComment.author))
            .where(ReviewComment.content_id == content_id)
            .order_by(ReviewComment.created_at)
        )
        return list(await self.session.scalars(stmt))

    async def get_detail(self, content_id: UUID) -> tuple[Content, str | None] | None:
        """One item in full, with its reviewer's name. Reaches hidden content."""
        reviewer = aliased(User)
        row = (
            await self.session.execute(
                select(Content, reviewer.name)
                .options(
                    selectinload(Content.author),
                    selectinload(Content.content_tags).selectinload(ContentTag.tag),
                    selectinload(Content.reports),
                    # Eager: ReviewDetail validates straight off the model, and a
                    # lazy relationship raises MissingGreenlet under async.
                    selectinload(Content.review_comments).selectinload(ReviewComment.author),
                )
                .join(reviewer, reviewer.id == Content.reviewed_by_id, isouter=True)
                .where(Content.id == content_id, Content.deleted_at.is_(None))
            )
        ).first()
        return (row[0], row[1]) if row else None

    async def get(self, content_id: UUID) -> Content | None:
        """Reaches hidden content on purpose — the board is where it is undone."""
        return await self.session.scalar(
            select(Content)
            .options(selectinload(Content.author))
            .where(Content.id == content_id, Content.deleted_at.is_(None))
        )

    async def count_suspensions(self, author_id: UUID) -> int:
        return (
            await self.session.scalar(
                select(func.count())
                .select_from(PostingSuspension)
                .where(PostingSuspension.user_id == author_id)
            )
        ) or 0

    async def active_suspension_end(self, author_id: UUID, now: dt.datetime) -> dt.datetime | None:
        return await self.session.scalar(
            select(PostingSuspension.expires_at).where(
                PostingSuspension.user_id == author_id,
                PostingSuspension.lifted_at.is_(None),
                PostingSuspension.starts_at <= now,
                (PostingSuspension.expires_at.is_(None)) | (PostingSuspension.expires_at > now),
            )
        )

    async def count_reports_against_author(self, author_id: UUID) -> int:
        return (
            await self.session.scalar(
                select(func.count())
                .select_from(ContentReport)
                .join(Content, Content.id == ContentReport.content_id)
                .where(Content.author_id == author_id, Content.deleted_at.is_(None))
            )
        ) or 0

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
