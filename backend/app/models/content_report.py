from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime

from app.domain.content_report_constraints import NOTE_MAX, RESOLUTION_NOTE_MAX
from app.domain.enums import ReportReason, ReportStatus

from .base import Base

if TYPE_CHECKING:
    from .content import Content
    from .user import User


class ContentReport(Base):
    __tablename__ = "content_reports"
    __table_args__ = (
        # One report per person per item or comment; two indexes because NULL != NULL.
        Index(
            "uq_content_reports_item_reporter",
            "content_id",
            "reporter_id",
            unique=True,
            postgresql_where=text("comment_id IS NULL"),
        ),
        Index(
            "uq_content_reports_comment_reporter",
            "comment_id",
            "reporter_id",
            unique=True,
            postgresql_where=text("comment_id IS NOT NULL"),
        ),
        Index("ix_content_reports_status_created_at", "status", "created_at"),
        Index("ix_content_reports_content_id", "content_id"),
        CheckConstraint(
            "status = 'open' OR resolved_at IS NOT NULL",
            name="ck_content_reports_closed_has_timestamp",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, nullable=False, default=uuid4
    )
    content_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("content.id", ondelete="CASCADE"), nullable=False
    )
    # Set for a comment report; `content_id` is then the comment's item.
    comment_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )
    reporter_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[ReportReason] = mapped_column(
        SAEnum(ReportReason, name="report_reason_enum"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(NOTE_MAX), nullable=True)
    status: Mapped[ReportStatus] = mapped_column(
        SAEnum(ReportStatus, name="report_status_enum"),
        nullable=False,
        default=ReportStatus.open,
    )
    created_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)

    resolved_by_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[dt.datetime | None] = mapped_column(
        SADateTime(timezone=True), nullable=True
    )
    resolution_note: Mapped[str | None] = mapped_column(String(RESOLUTION_NOTE_MAX), nullable=True)

    # Relationships
    content: Mapped[Content] = relationship(back_populates="reports")
    reporter: Mapped[User] = relationship(foreign_keys=[reporter_id])
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id])
