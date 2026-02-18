from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from backend.app.schemas.user import UserOut
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.domain.content_constraints import (
    AGE_MAX,
    DESC_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
)
from app.utils import get_current_datetime

if TYPE_CHECKING:
    from app.schemas.tag import TagOut
    from app.schemas.user import UserOut

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
LocationStr = Annotated[
    str, StringConstraints(min_length=0, max_length=LOCATION_MAX, strip_whitespace=True)
]


class ContentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr
    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    duration: int | None = None
    age: AgeStr | None = None
    location: LocationStr | None = None
    count: int | None = None
    price: int | None = None
    like_count: int = 0
    author_id: UUID | None = None
    created_at: dt.datetime = Field(default_factory=get_current_datetime)

    @field_validator("like_count")
    @classmethod
    def validate_like_count(cls, v: int) -> int:
        if v < 0:
            raise ValueError("like_count must be >= 0")
        return v

    @field_validator("duration", "count", "price")
    @classmethod
    def validate_non_negative_ints(cls, v: int | None, info) -> int | None:
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
    duration: int | None = None
    age: AgeStr | None = None
    location: LocationStr | None = None
    count: int | None = None
    price: int | None = None
    like_count: int | None = None

    @field_validator("like_count")
    @classmethod
    def validate_like_count(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("like_count must be >= 0")
        return v

    @field_validator("duration", "count", "price")
    @classmethod
    def validate_non_negative_ints(cls, v: int | None, info) -> int | None:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be >= 0")
        return v


class ContentOut(ContentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author: UserOut
    tags: list[TagOut] = []
    comment_count: int = 0
