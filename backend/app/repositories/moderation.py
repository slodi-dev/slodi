from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, ScalarSelect, Select, String, and_, cast, func, or_, select
from sqlalchemy.orm import aliased, selectinload

from app.domain.enums import ReportStatus, ReviewState
from app.models.comment import Comment
from app.models.content import Content
from app.models.content_report import ContentReport
from app.models.review_comment import ReviewComment
from app.models.tag import ContentTag
from app.models.user import User
from app.schemas.moderation import ReviewFilters

from .base import Repository


def _open_item_report() -> ColumnElement[bool]:
    """An open report on the item itself; reports on its comments are judged separately."""
    return and_(
        ContentReport.content_id == Content.id,
        ContentReport.status == ReportStatus.open,
        ContentReport.comment_id.is_(None),
    )


def _is_strike(item: type[Content]) -> ColumnElement[bool]:
    """A rejected item that is not deleted; derived, so a reversed rejection drops it."""
    return and_(item.deleted_at.is_(None), item.review_state == ReviewState.rejected)


def open_report_reasons_subq() -> ScalarSelect[Any]:
    """The distinct reasons in the open reports on the item, as an array."""
    return (
        # Cast to text first: psycopg returns an array of a custom enum as one string.
        select(func.array_agg(func.distinct(cast(ContentReport.reason, String))))
        .where(_open_item_report())
        .correlate(Content)
        .scalar_subquery()
    )


def author_strikes_subq() -> ScalarSelect[int]:
    """The author's strikes, per queue row."""
    author = aliased(Content)
    return (
        select(func.count())
        .select_from(author)
        .where(author.author_id == Content.author_id, _is_strike(author))
        .correlate(Content)
        .scalar_subquery()
    )


def open_report_count_subq() -> ScalarSelect[int]:
    """Open reports against a piece of content, as a correlated scalar."""
    return (
        select(func.count(ContentReport.id))
        .where(_open_item_report())
        .correlate(Content)
        .scalar_subquery()
    )


class ModerationRepository(Repository):
    def _apply_filters(self, stmt: Select, filters: ReviewFilters) -> Select:
        """Every WHERE the board can ask for; shared by the list and the count."""
        stmt = stmt.where(Content.deleted_at.is_(None))

        if filters.review_state is not None:
            stmt = stmt.where(Content.review_state == filters.review_state)
        if filters.content_type is not None:
            stmt = stmt.where(Content.content_type == filters.content_type)
        if filters.workspace_id is not None:
            stmt = stmt.where(Content.workspace_id == filters.workspace_id)
        if filters.reported:
            stmt = stmt.where(select(ContentReport.id).where(_open_item_report()).exists())
        if filters.author:
            stmt = stmt.where(
                Content.author_id.in_(select(User.id).where(User.name.ilike(f"%{filters.author}%")))
            )
        if filters.search:
            stmt = stmt.where(Content.name.ilike(f"%{filters.search}%"))

        # The date range applies to the column the view is sorted by.
        date_col = (
            Content.created_at
            if filters.review_state == ReviewState.unreviewed
            else Content.reviewed_at
        )
        if filters.date_from:
            stmt = stmt.where(date_col >= filters.date_from)
        if filters.date_to:
            # Inclusive of the whole end day.
            stmt = stmt.where(date_col < filters.date_to + dt.timedelta(days=1))

        return stmt

    def _queue_stmt(self, filters: ReviewFilters) -> Select:
        """One page of the board: the unreviewed queue oldest first, other views latest decision first."""
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
        """How many match; skips `_queue_stmt`'s per-row subqueries, which only fill a row."""
        stmt = self._apply_filters(select(func.count()).select_from(Content), filters)
        return (await self.session.scalar(stmt)) or 0

    async def list_comments(self, content_id: UUID) -> list[ReviewComment]:
        """One item's reviewer notes, oldest first."""
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

    async def count_reports_against_author(self, author_id: UUID) -> int:
        """Reports on the person's items and on their comments, dismissed ones included."""
        return (
            await self.session.scalar(
                select(func.count())
                .select_from(ContentReport)
                .join(Content, Content.id == ContentReport.content_id)
                .outerjoin(Comment, Comment.id == ContentReport.comment_id)
                .where(
                    or_(
                        and_(
                            ContentReport.comment_id.is_(None),
                            Content.author_id == author_id,
                            Content.deleted_at.is_(None),
                        ),
                        Comment.user_id == author_id,
                    )
                )
            )
        ) or 0

    async def count_strikes(self, author_id: UUID) -> int:
        return (
            await self.session.scalar(
                select(func.count())
                .select_from(Content)
                .where(Content.author_id == author_id, _is_strike(Content))
            )
        ) or 0
