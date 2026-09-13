from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.domain.comment_constraints import BODY_MAX, BODY_MIN
from app.utils import get_current_datetime

BodyStr = Annotated[
    str,
    StringConstraints(min_length=BODY_MIN, max_length=BODY_MAX, strip_whitespace=True),
]


class CommentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: BodyStr
    user_id: UUID
    content_id: UUID


class CommentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: BodyStr
    user_id: UUID
    created_at: dt.datetime = Field(default_factory=get_current_datetime)


class CommentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: BodyStr


class CommentOut(CommentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: dt.datetime
    author_name: str
