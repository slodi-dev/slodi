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
    DURATION_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
)
from app.models.content import AgeGroup
from app.repositories.content import ContentStats
from app.schemas.tag import TagOut
from app.schemas.user import UserOut
from app.utils import get_current_datetime

# Lookup maps for age group normalisation (used by validators below).
_AGE_GROUP_BY_VALUE: dict[str, AgeGroup] = {e.value: e for e in AgeGroup}
_AGE_GROUP_BY_NAME: dict[str, AgeGroup] = {e.name: e for e in AgeGroup}


def _normalise_age_item(raw: object) -> AgeGroup:
    """Accept an AgeGroup by its Icelandic *value* (preferred) or Python *name*."""
    if isinstance(raw, AgeGroup):
        return raw
    s = str(raw)
    if s in _AGE_GROUP_BY_VALUE:
        return _AGE_GROUP_BY_VALUE[s]
    if s in _AGE_GROUP_BY_NAME:
        return _AGE_GROUP_BY_NAME[s]
    valid = ", ".join(repr(v) for v in _AGE_GROUP_BY_VALUE)
    raise ValueError(f"Invalid age group {s!r}. Valid values: {valid}")

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
DurationStr = Annotated[
    str, StringConstraints(min_length=0, max_length=DURATION_MAX, strip_whitespace=True)
]
LocationStr = Annotated[
    str, StringConstraints(min_length=0, max_length=LOCATION_MAX, strip_whitespace=True)
]


class ContentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    name: NameStr
    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    duration: DurationStr | None = None
    age: list[AgeGroup] | None = None
    location: LocationStr | None = None
    count: int | None = None
    price: int | None = None
    prep_time: DurationStr | None = None
    author_id: UUID | None = None
    created_at: dt.datetime = Field(default_factory=get_current_datetime)

    @field_validator("age", mode="before")
    @classmethod
    def normalise_age_groups(cls, v: object) -> list[AgeGroup] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("age must be a list")
        return [_normalise_age_item(item) for item in v]

    @field_validator("count", "price")
    @classmethod
    def validate_non_negative_ints(cls, v: int | None, info: ValidationInfo) -> int | None:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be >= 0")
        return v


class ContentCreate(ContentBase):
    pass


class ContentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    name: NameStr | None = None
    description: DescStr | None = None
    equipment: list[str] | None = None
    instructions: InstructionsStr | None = None
    duration: DurationStr | None = None
    age: list[AgeGroup] | None = None
    location: LocationStr | None = None
    count: int | None = None
    price: int | None = None
    prep_time: DurationStr | None = None

    @field_validator("age", mode="before")
    @classmethod
    def normalise_age_groups(cls, v: object) -> list[AgeGroup] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("age must be a list")
        return [_normalise_age_item(item) for item in v]

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
