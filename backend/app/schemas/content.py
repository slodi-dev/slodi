from __future__ import annotations

import datetime as dt
from typing import Annotated, Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)
from typing_extensions import Self

from app.domain.content_constraints import (
    DESC_MAX,
    IMG_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
)
from app.domain.enums import AgeGroup
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


class ContentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
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
    media: dict[str, Any] | None = None
    tag_names: list[str] | None = None
    author_id: UUID | None = None

    @field_validator(
        "count_min",
        "count_max",
        "duration_min",
        "duration_max",
        "prep_time_min",
        "prep_time_max",
        "price",
    )
    @classmethod
    def validate_non_negative_ints(cls, v: int | None, info: ValidationInfo) -> int | None:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be >= 0")
        return v


class ContentCreate(ContentBase):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    name: NameStr
    created_at: dt.datetime = Field(default_factory=get_current_datetime)


class ContentUpdate(ContentBase):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    name: NameStr | None = None


class ContentListOut(BaseModel):
    """Content details for list views, without author info or comments."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: UUID
    name: NameStr
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
    tags: list[TagOut] = []
    comment_count: int = 0
    like_count: int = 0
    liked_by_me: bool = False

    @classmethod
    def from_row(cls, obj: Any, stats: ContentStats) -> Self:
        return cls.model_validate(obj).model_copy(update=vars(stats))


class ContentOut(ContentListOut):
    """Full content details, including author info and comments."""

    author: UserOutLimited
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    media: dict[str, Any] | None = None
    comments: list[CommentOut] = []


UserOutLimited.model_rebuild()
TagOut.model_rebuild()
