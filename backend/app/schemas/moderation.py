from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from typing_extensions import Self

from app.domain.content_constraints import REVIEW_NOTE_MAX
from app.domain.enums import (
    HIDDEN_REVIEW_STATES,
    ContentType,
    ReportReason,
    ReviewCommentVisibility,
    ReviewState,
)
from app.domain.review_comment_constraints import BODY_MAX as COMMENT_BODY_MAX
from app.schemas.content_report import ContentReportOut


class ReviewDecision(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    review_state: ReviewState
    note: str | None = Field(None, max_length=REVIEW_NOTE_MAX)

    @model_validator(mode="after")
    def hiding_needs_a_reason(self) -> Self:
        # The author is emailed the note; without one they cannot fix anything.
        if self.review_state in HIDDEN_REVIEW_STATES and not self.note:
            raise ValueError("Segðu höfundi af hverju efnið er tekið úr bankanum.")
        # `unreviewed` is allowed: it is how the board undoes a decision.
        return self


class ReviewQueueItem(BaseModel):
    """One row of the board."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    content_type: ContentType
    name: str
    description: str | None = None
    instructions: str | None = None
    author_id: UUID
    author_name: str
    created_at: dt.datetime
    review_state: ReviewState
    hidden_at: dt.datetime | None = None
    review_note: str | None = None
    open_report_count: int = 0
    open_report_reasons: list[ReportReason] = []
    author_strikes: int = 0
    reviewed_by_name: str | None = None
    reviewed_at: dt.datetime | None = None


class ReviewFilters(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    review_state: ReviewState | None = None
    content_type: ContentType | None = None
    reported: bool | None = None
    search: str | None = None
    author: str | None = None
    """Substring of the author's name."""
    date_from: dt.date | None = None
    date_to: dt.date | None = None
    """Over the column the view is sorted by: submitted when unreviewed, decided otherwise."""


class ReportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    reason: ReportReason
    note: str | None = None
    created_at: dt.datetime


class UnreviewedCount(BaseModel):
    """How much is waiting on the review board, for the sidebar badge.

    A count of its own rather than a page of the queue: the sidebar renders on
    every authenticated page, and asking for a page to learn a number costs two
    extra queries and a row nobody reads.
    """

    count: int


class ReviewCommentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    body: Annotated[str, StringConstraints(min_length=1, max_length=COMMENT_BODY_MAX)]
    visibility: ReviewCommentVisibility
    """No default: whether a note reaches the author is always chosen."""


class ReviewCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    body: str
    visibility: ReviewCommentVisibility
    created_at: dt.datetime
    author_name: str | None = None
    """Null once the reviewer's account is removed."""


class Attachment(BaseModel):
    """A file in `Content.media["documents"]`; entries that do not match are skipped."""

    model_config = ConfigDict(extra="ignore")

    name: str
    url: str
    content_type: str | None = None


class ReviewDetail(ReviewQueueItem):
    """The whole item, for the reading pane."""

    equipment: list[str] | None = None
    duration_min: int | None = None
    duration_max: int | None = None
    prep_time_min: int | None = None
    prep_time_max: int | None = None
    count_min: int | None = None
    count_max: int | None = None
    price: int | None = None
    location: str | None = None
    age: list[str] | None = None
    image: str | None = None
    tags: list[str] = []
    workspace_id: UUID

    @field_validator("tags", mode="before")
    @classmethod
    def _tag_names(cls, value: object) -> object:
        """`Content.tags` holds `Tag` objects; this runs before validation, so it must convert."""
        if isinstance(value, list):
            return [getattr(v, "name", v) for v in value]
        return value

    reports: list[ReportSummary] = []
    review_comments: list[ReviewCommentOut] = []
    """Not `comments`: on the model that is the public discussion between leaders."""
    documents: list[Attachment] = []
    author_reports_received: int = 0
    author_suspension_count: int = 0
    author_suspended_until: dt.datetime | None = None


class ReportQueueItem(ContentReportOut):
    """A report with the names the board needs; the `comment_*` fields are set for comment reports."""

    content_name: str
    content_author_name: str
    comment_body: str | None = None
    comment_author_name: str | None = None
    comment_created_at: dt.datetime | None = None
