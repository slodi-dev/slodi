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
