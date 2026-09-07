from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator
from typing_extensions import Self

from app.domain.content_constraints import REVIEW_NOTE_MAX
from app.domain.enums import ContentType, ReviewState

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
        if self.review_state == ReviewState.unreviewed:
            raise ValueError("Notaðu 'approved' eða 'rejected' til að ljúka yfirferð.")
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
    """How many open reports this item carries — the reason it may be urgent."""
