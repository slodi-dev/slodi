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
    AGE_MAX,
    DESC_MAX,
    DURATION_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
)
from app.repositories.content import ContentStats
from app.schemas.tag import TagOut
from app.schemas.user import UserOut
from app.utils import get_current_datetime

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
AgeStr = Annotated[str, StringConstraints(min_length=0, max_length=AGE_MAX, strip_whitespace=True)]
DurationStr = Annotated[
    str, StringConstraints(min_length=0, max_length=DURATION_MAX, strip_whitespace=True)
]
LocationStr = Annotated[
    str, StringConstraints(min_length=0, max_length=LOCATION_MAX, strip_whitespace=True)
]


class ContentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr
    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    duration: DurationStr | None = None
    age: AgeStr | None = None
    location: LocationStr | None = None
    count: int | None = None
    price: int | None = None
    prep_time: DurationStr | None = None
    author_id: UUID | None = None
    created_at: dt.datetime = Field(default_factory=get_current_datetime)

    @field_validator("count", "price")
    @classmethod
    def validate_non_negative_ints(cls, v: int | None, info: ValidationInfo) -> int | None:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be >= 0")
        return v


class ContentCreate(ContentBase):
    pass


class ContentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr | None = None
    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    duration: DurationStr | None = None
    age: AgeStr | None = None
    location: LocationStr | None = None
    count: int | None = None
    price: int | None = None
    prep_time: DurationStr | None = None

    @field_validator("count", "price")
    @classmethod
    def validate_non_negative_ints(cls, v: int | None, info: ValidationInfo) -> int | None:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be >= 0")
        return v


class ContentOut(ContentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author: UserOut
    tags: list[TagOut] = []
    comment_count: int = 0
    like_count: int = 0
    liked_by_me: bool = False

    @classmethod
    def from_row(cls, obj: Any, stats: ContentStats) -> Self:
        return cls.model_validate(obj).model_copy(update=vars(stats))


UserOut.model_rebuild()
TagOut.model_rebuild()
