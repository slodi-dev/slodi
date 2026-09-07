from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator
from typing_extensions import Self

from app.domain.content_constraints import REVIEW_NOTE_MAX
from app.domain.enums import ContentType, ReportReason, ReviewState
from app.schemas.content_report import ContentReportOut

ReviewNoteStr = Annotated[str, StringConstraints(max_length=REVIEW_NOTE_MAX, strip_whitespace=True)]


class ReviewDecision(BaseModel):
    """A reviewer saying what they think of one item."""

    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    review_state: ReviewState
    note: ReviewNoteStr | None = None

    @model_validator(mode="after")
    def rejection_needs_a_reason(self) -> Self:
        if self.review_state == ReviewState.rejected and not self.note:
            # A rejection with no reason is a dead end for the author: they
            # cannot fix what they are not told about, so they either give up or
            # resubmit the same thing.
            raise ValueError("Segðu af hverju efninu var hafnað svo höfundur geti lagað það.")
        # `unreviewed` is allowed on purpose: it is how a reviewer undoes a
        # decision and puts something back in the queue. A keyboard sweep at
        # one key per item will mis-key sooner or later, and without a way back
        # the only remedy is remembering what the previous state was.
        return self


class HideDecision(BaseModel):
    """Taking something out of the bank, or putting it back."""

    model_config = ConfigDict(str_strip_whitespace=True)

    hidden: bool
    note: ReviewNoteStr | None = None


class ReviewQueueItem(BaseModel):
    """One row of Óyfirfarið — enough to judge it without opening it."""

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
    """How many people have objected — the reason a row may be urgent."""

    open_report_reasons: list[ReportReason] = []
    """*Why* they objected. A count alone sends the reviewer to another tab for
    every flagged row, which is where a fifty-item sweep loses its afternoon."""

    author_strikes: int = 0
    """How much of this author's work a moderator has already acted against.
    Lets a reviewer tell a first-time contributor from a repeat one in place."""

    reviewed_by_name: str | None = None
    reviewed_at: dt.datetime | None = None
    """Who decided, and when. The queue is also the record of what was done —
    without a name a decision has no author, and "who approved this?" becomes a
    question only the database can answer."""


class ReviewFilters(BaseModel):
    """What the board is currently looking at.

    The default is the unreviewed queue, because that is the working view. The
    others exist so the team can answer "who approved this, and when?" without
    reaching for the database.
    """

    model_config = ConfigDict(use_enum_values=True)

    review_state: ReviewState | None = None
    hidden: bool | None = None
    content_type: ContentType | None = None
    reported: bool | None = None
    """Only things somebody has objected to."""
    search: str | None = None


class ReportSummary(BaseModel):
    """One objection, as the detail pane shows it."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    reason: ReportReason
    note: str | None = None
    created_at: dt.datetime


class ReviewDetail(ReviewQueueItem):
    """The whole item, for the reading pane.

    Fetched per selection rather than carried on every row: instructions run to
    thousands of characters, and a hundred of them would make the list slow to
    load in order to fill a pane showing one.
    """

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
    reports: list[ReportSummary] = []
    """The objections themselves, so judging a flagged item does not mean
    holding two screens open at once."""


class ReportQueueItem(ContentReportOut):
    """A report as the board shows it.

    Carries the content's name and author, which the reporter-facing
    `ContentReportOut` has no reason to. Without them a reviewer reads a
    complaint with no idea what it is about and has to open every single row to
    find out — which is the whole cost the board exists to remove.
    """

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    content_name: str
    content_author_name: str
