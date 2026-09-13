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
    """One person flagging one item.

    Not soft-deletable: a resolved report is closed, not removed. The record is
    what lets a reviewer see that an item has been flagged before, and — once
    the review board lands — how often a given author's work has been.
    """

    __tablename__ = "content_reports"
    __table_args__ = (
        # One report per person per target. Without this a single account can
        # stack a queue against something it dislikes, and the count a reviewer
        # reads stops meaning "how many people" and starts meaning "how
        # determined was one person".
        #
        # Two partial indexes rather than one constraint over three columns:
        # in Postgres NULL is distinct from NULL, so a plain
        # UNIQUE(content_id, comment_id, reporter_id) would stop deduplicating
        # item reports the moment `comment_id` was allowed to be null.
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
        # The review board's query: open reports, newest first.
        Index("ix_content_reports_status_created_at", "status", "created_at"),
        # Counting an author's reports means joining through content.
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
    comment_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )
    """Set when the report is about a comment rather than the item itself.

    `content_id` stays populated either way: a comment always hangs under an
    item, and the board needs to say which one without a second join.
    """

    reporter_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[ReportReason] = mapped_column(
        SAEnum(ReportReason, name="report_reason_enum"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(NOTE_MAX), nullable=True)
    """What the reporter added in their own words. Optional — asking for a
    reason and a paragraph is how a report does not get filed at all."""

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
