from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.domain.enums import ReportReason, ReportStatus
from app.models.comment import Comment
from app.models.content import Content
from app.models.content_report import ContentReport
from app.models.user import User

from .base import Repository


class ContentReportRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, report_id: UUID) -> ContentReport | None:
        return await self.session.scalar(select(ContentReport).where(ContentReport.id == report_id))

    async def find_by_reporter(
        self, content_id: UUID, reporter_id: UUID, comment_id: UUID | None = None
    ) -> ContentReport | None:
        """The report this person already filed against this exact target.

        A comment report and an item report are different things, so reporting
        a comment must not return the reporter's earlier report of the item it
        hangs under — and `comment_id IS NULL` has to be written out, because
        `== None` on a nullable column is not what `IS NULL` means in SQL.
        """
        target = (
            ContentReport.comment_id.is_(None)
            if comment_id is None
            else ContentReport.comment_id == comment_id
        )
        return await self.session.scalar(
            select(ContentReport).where(
                ContentReport.content_id == content_id,
                ContentReport.reporter_id == reporter_id,
                target,
            )
        )

    async def list_open_with_content(
        self, limit: int, offset: int
    ) -> list[tuple[ContentReport, str, str, str | None, str | None]]:
        """Open reports, each with what it is about.

        The comment is an **outer** join: most reports are about the item, and
        an inner join would quietly drop every one of them.
        """
        unsafe_first = (ContentReport.reason == ReportReason.unsafe).desc()
        commenter = aliased(User)
        stmt = (
            select(ContentReport, Content.name, User.name, Comment.body, commenter.name)
            .join(Content, Content.id == ContentReport.content_id)
            .join(User, User.id == Content.author_id)
            .outerjoin(Comment, Comment.id == ContentReport.comment_id)
            .outerjoin(commenter, commenter.id == Comment.user_id)
            .where(ContentReport.status == ReportStatus.open)
            .order_by(unsafe_first, ContentReport.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = await self.session.execute(stmt)
        return [tuple(r) for r in rows.all()]

    async def list_open(self, limit: int, offset: int) -> list[ContentReport]:
        """The review board's queue.

        `unsafe` first, then newest. Sorting it here rather than in the board
        means the pinning survives paging — an escalation on page two is an
        escalation nobody sees.
        """
        unsafe_first = (ContentReport.reason == ReportReason.unsafe).desc()
        stmt = (
            select(ContentReport)
            .where(ContentReport.status == ReportStatus.open)
            .order_by(unsafe_first, ContentReport.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(await self.session.scalars(stmt))

    async def count_open(self) -> int:
        from sqlalchemy import func

        return (
            await self.session.scalar(
                select(func.count())
                .select_from(ContentReport)
                .where(ContentReport.status == ReportStatus.open)
            )
        ) or 0
