from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ReportReason, ReportStatus
from app.models.content_report import ContentReport

from .base import Repository


class ContentReportRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, report_id: UUID) -> ContentReport | None:
        return await self.session.scalar(select(ContentReport).where(ContentReport.id == report_id))

    async def find_by_reporter(self, content_id: UUID, reporter_id: UUID) -> ContentReport | None:
        return await self.session.scalar(
            select(ContentReport).where(
                ContentReport.content_id == content_id,
                ContentReport.reporter_id == reporter_id,
            )
        )

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
