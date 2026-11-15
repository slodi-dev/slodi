from __future__ import annotations

from typing import Literal
from uuid import UUID

from app.domain.enums import ContentType

from .content import ContentCreate, ContentListOut, ContentOut, ContentUpdate


class TaskCreate(ContentCreate):
    content_type: Literal[ContentType.task] = ContentType.task


class TaskUpdate(ContentUpdate):
    event_id: UUID | None = None


class TaskListOut(ContentListOut):
    event_id: UUID | None = None


class TaskOut(ContentOut):
    event_id: UUID | None = None
