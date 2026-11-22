from __future__ import annotations

import html
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
        comment_id: UUID | None = None,
    ) -> ContentReportOut:
        existing = await self.repo.find_by_reporter(content_id, reporter_id, comment_id)
        if existing is not None:
            # The same answer again, not a 409: a second click is not a failure.
            return ContentReportOut.model_validate(existing)

        report = ContentReport(
            content_id=content_id,
            comment_id=comment_id,
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
            # Two clicks racing: the unique index decides, and both get the one report.
            await self.session.rollback()
            existing = await self.repo.find_by_reporter(content_id, reporter_id, comment_id)
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
        """An `unsafe` report is emailed to the moderators at once, not left in the queue."""
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
                f"<p><strong>Heiti:</strong> {html.escape(content_name)}</p>"
                f"<p><strong>Skýring:</strong> {html.escape(note)}</p>"
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
                comment_body=comment_body,
                comment_author_name=comment_author,
                comment_created_at=comment_created_at,
            )
            for r, name, author, comment_body, comment_author, comment_created_at in rows
        ]

    async def count_open(self) -> int:
        return await self.repo.count_open()

    async def resolve(
        self, report_id: UUID, resolver_id: UUID, data: ContentReportResolve
    ) -> ContentReportOut:
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
