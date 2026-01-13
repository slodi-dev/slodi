from __future__ import annotations

import datetime as dt
from typing import Annotated, TYPE_CHECKING
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.domain.content_constraints import DESC_MAX, NAME_MAX, NAME_MIN
from app.utils import get_current_datetime

if TYPE_CHECKING:
    from app.schemas.tag import TagOut
    from app.schemas.user import UserNested

NameStr = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]
DescStr = Annotated[
    str, StringConstraints(min_length=0, max_length=DESC_MAX, strip_whitespace=True)
]


class ContentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr
    description: DescStr | None = None
    like_count: int = 0
    created_at: dt.datetime = Field(default_factory=get_current_datetime)
    author_id: UUID

    @field_validator("like_count")
    @classmethod
    def validate_like_count(cls, v: int) -> int:
        if v < 0:
            raise ValueError("like_count must be >= 0")
        return v


class ContentCreate(ContentBase):
    pass


class ContentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr | None = None
    description: DescStr | None = None
    like_count: int | None = None

    @field_validator("like_count")
    @classmethod
    def validate_like_count(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("like_count must be >= 0")
        return v


class ContentOut(ContentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author: "UserNested"
    tags: list["TagOut"] = []
    comment_count: int = 0
