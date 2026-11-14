from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from app.domain.content_report_constraints import (
    COMMENT_REPORT_REASONS,
    NOTE_MAX,
    RESOLUTION_NOTE_MAX,
)
from app.domain.enums import ReportReason, ReportStatus

NoteStr = Annotated[str, StringConstraints(max_length=NOTE_MAX, strip_whitespace=True)]
ResolutionStr = Annotated[
    str, StringConstraints(max_length=RESOLUTION_NOTE_MAX, strip_whitespace=True)
]


class ContentReportCreate(BaseModel):
    """What someone filing a report sends.

    The note is optional on purpose. Requiring a reason *and* a paragraph is how
    a report does not get filed at all — and an unfiled report tells the team
    nothing.
    """

    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    reason: ReportReason
    note: NoteStr | None = None


class CommentReportCreate(ContentReportCreate):
    """A report on a comment, which can only be for the reasons that fit one."""

    @field_validator("reason")
    @classmethod
    def reason_fits_a_comment(cls, reason: ReportReason) -> ReportReason:
        # `use_enum_values` may hand this the plain string, so compare as members.
        if ReportReason(reason) not in COMMENT_REPORT_REASONS:
            raise ValueError("a comment cannot be reported for this reason")
        return reason


class ContentReportResolve(BaseModel):
    """A reviewer closing a report."""

    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    status: ReportStatus
    resolution_note: ResolutionStr | None = None


class ContentReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    content_id: UUID
    #: Set when the report is about a comment under the item rather than the item.
    comment_id: UUID | None = None
    reporter_id: UUID
    reason: ReportReason
    note: str | None = None
    status: ReportStatus
    created_at: dt.datetime
    resolved_by_id: UUID | None = None
    resolved_at: dt.datetime | None = None
    resolution_note: str | None = None
