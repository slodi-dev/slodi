from __future__ import annotations

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.domain.tag_constraints import NAME_MAX, NAME_MIN

TagName = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]


class TagBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: TagName


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: TagName


class TagOut(TagBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


# -------- ContentTag --------
