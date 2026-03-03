from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict

from app.models.content import ContentType

from .content import ContentCreate, ContentListOut, ContentOut, ContentUpdate
from .event import EventListOut


class ProgramCreate(ContentCreate):
    content_type: Literal[ContentType.program] = ContentType.program


class ProgramUpdate(ContentUpdate):
    pass


class ProgramListOut(ContentListOut):
    model_config = ConfigDict(from_attributes=True)
    pass


class ProgramOut(ContentOut):
    model_config = ConfigDict(from_attributes=True)
    events: list[EventListOut] = []
