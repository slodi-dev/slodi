from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import ConfigDict

from app.domain.enums import ContentType

from .content import ContentCreate, ContentListOut, ContentOut, ContentUpdate


class TaskCreate(ContentCreate):
    content_type: Literal[ContentType.task] = ContentType.task


class TaskUpdate(ContentUpdate):
    event_id: UUID | None = None


class TaskListOut(ContentListOut):
    model_config = ConfigDict(from_attributes=True)

    event_id: UUID | None = None


class TaskOut(ContentOut):
    model_config = ConfigDict(from_attributes=True)

    event_id: UUID | None = None
