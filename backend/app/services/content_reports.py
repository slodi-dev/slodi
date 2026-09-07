from __future__ import annotations

import logging
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_email_background
from app.domain.enums import ReportReason, ReportStatus
from app.models.content_report import ContentReport
from app.repositories.content_reports import ContentReportRepository
from app.schemas.content_report import (
    ContentReportCreate,
    ContentReportOut,
    ContentReportResolve,
)
from app.schemas.moderation import ReportQueueItem
from app.settings import settings
from app.utils import get_current_datetime

logger = logging.getLogger(__name__)


class ContentReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ContentReportRepository(session)

    async def report(
        self,
        content_id: UUID,
        reporter_id: UUID,
        data: ContentReportCreate,
        background_tasks: BackgroundTasks,
        content_name: str,
    ) -> ContentReportOut:
        existing = await self.repo.find_by_reporter(content_id, reporter_id)
        if existing is not None:
            # Idempotent rather than an error. The person has already said this;
            # a 409 here would read as "your report failed" and invite a retry.
            return ContentReportOut.model_validate(existing)

        report = ContentReport(
            content_id=content_id,
            reporter_id=reporter_id,
            reason=data.reason,
            note=data.note,
            status=ReportStatus.open,
            created_at=get_current_datetime(),
        )
        await self.repo.add(report)
        try:
            await self.session.commit()
        except IntegrityError:
            # Two reports from the same person racing each other. The unique
            # constraint is the real guard; this just turns it back into the
            # same answer the first branch gives.
            await self.session.rollback()
            existing = await self.repo.find_by_reporter(content_id, reporter_id)
            if existing is None:
                raise
            return ContentReportOut.model_validate(existing)

        await self.session.refresh(report)
        if report.reason == ReportReason.unsafe:
            self._escalate(background_tasks, report, content_name)
        return ContentReportOut.model_validate(report)

    def _escalate(
        self, background_tasks: BackgroundTasks, report: ContentReport, content_name: str
    ) -> None:
        """An `unsafe` report is escalated, not queued.

        Everything else waits for the next sweep of the review board. This one
        does not: it is the safeguarding case, and a queue the team reads weekly
        is not a response time for it.
        """
        recipients = settings.moderation_email_list
        if not recipients:
            logger.error(
                "Unsafe report %s could not be escalated — no moderation recipients configured",
                report.id,
            )
            return
        note = report.note or "(engin skýring gefin)"
        send_email_background(
            background_tasks,
            recipients,
            "Slóði — efni tilkynnt sem óöruggt",
            (
                f"<p>Efni í dagskrárbankanum var tilkynnt sem <strong>óöruggt</strong>.</p>"
                f"<p><strong>Heiti:</strong> {content_name}</p>"
                f"<p><strong>Skýring:</strong> {note}</p>"
                f"<p>Farðu yfir það í Yfirferð.</p>"
            ),
        )

    async def list_open(self, limit: int, offset: int) -> list[ReportQueueItem]:
        rows = await self.repo.list_open_with_content(limit, offset)
        return [
            ReportQueueItem(
                **ContentReportOut.model_validate(r).model_dump(),
                content_name=name,
                content_author_name=author,
            )
            for r, name, author in rows
        ]

    async def count_open(self) -> int:
        return await self.repo.count_open()

    async def resolve(
        self, report_id: UUID, resolver_id: UUID, data: ContentReportResolve
    ) -> ContentReportOut:
        # Checked before the lookup: a nonsensical request does not deserve a
        # database round trip, and the answer is the same whether the report
        # exists or not.
        if data.status == ReportStatus.open:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use 'resolved' or 'dismissed' to close a report.",
            )
        report = await self.repo.get(report_id)
        if report is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

        report.status = data.status
        report.resolution_note = data.resolution_note
        report.resolved_by_id = resolver_id
        report.resolved_at = get_current_datetime()
        await self.session.commit()
        await self.session.refresh(report)
        return ContentReportOut.model_validate(report)
