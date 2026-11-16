from __future__ import annotations

import datetime as dt
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Self

from app.domain.content_constraints import (
    DESC_MAX,
    IMG_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
)
from app.domain.enums import AgeGroup, ContentLevel, ContentType, ReviewState
from app.repositories.content import ContentStats
from app.schemas.comment import CommentOut
from app.schemas.tag import TagOut
from app.schemas.user import UserOutLimited
from app.utils import get_current_datetime

from .workspace import WorkspaceNested

NameStr = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]
DescStr = Annotated[
    str, StringConstraints(min_length=0, max_length=DESC_MAX, strip_whitespace=True)
]
InstructionsStr = Annotated[
    str,
    StringConstraints(min_length=0, max_length=INSTRUCTIONS_MAX, strip_whitespace=True),
]
LocationStr = Annotated[
    str, StringConstraints(min_length=0, max_length=LOCATION_MAX, strip_whitespace=True)
]
ImageStr = Annotated[
    str, StringConstraints(min_length=0, max_length=IMG_MAX, strip_whitespace=True)
]
NonNegInt = Annotated[int, Field(ge=0)]


class ContentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    duration_min: NonNegInt | None = None
    duration_max: NonNegInt | None = None
    age: list[AgeGroup] | None = None
    location: LocationStr | None = None
    count_min: NonNegInt | None = None
    count_max: NonNegInt | None = None
    price: NonNegInt | None = None
    prep_time_min: NonNegInt | None = None
    prep_time_max: NonNegInt | None = None
    image: ImageStr | None = None
    media: dict[str, Any] | None = None
    tag_names: list[str] | None = None


class ContentCreate(ContentBase):
    name: NameStr
    # Server-owned: create routes set both through `authored_by`.
    author_id: UUID | None = None
    created_at: dt.datetime = Field(default_factory=get_current_datetime)


class ContentCreateAtLevel(ContentCreate):
    level: ContentLevel


class ContentUpdate(ContentBase):
    # No `author_id`: the update services `setattr` every field in the patch.
    name: NameStr | None = None


class ContentListOut(BaseModel):
    """Content details for list views, without author info or comments."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    name: NameStr
    content_type: ContentType
    level: int
    copied_from_id: UUID | None = None
    times_used: int = 0
    author_id: UUID
    author_name: str
    created_at: dt.datetime
    workspace_id: UUID
    workspace: WorkspaceNested
    description: DescStr | None = None
    duration_min: int | None = None
    duration_max: int | None = None
    age: list[AgeGroup] | None = None
    location: LocationStr | None = None
    count_min: int | None = None
    count_max: int | None = None
    price: int | None = None
    prep_time_min: int | None = None
    prep_time_max: int | None = None
    image: ImageStr | None = None
    equipment: list[str] | None = None
    tags: list[TagOut] = []
    comment_count: int = 0
    like_count: int = 0
    liked_by_me: bool = False
    # Non-null only where a moderator's listing keeps hidden items in.
    hidden_at: dt.datetime | None = None

    @classmethod
    def from_row(cls, obj: Any, stats: ContentStats) -> Self:
        return cls.model_validate(obj).model_copy(update=vars(stats))


class ContentOut(ContentListOut):
    """Full content details, including author info and comments."""

    author: UserOutLimited
    # Only for the item's author and moderators; routes strip them via `strip_review_fields`.
    review_state: ReviewState | None = None
    review_note: str | None = None
    instructions: InstructionsStr | None = None
    media: dict[str, Any] | None = None
    comments: list[CommentOut] = []
