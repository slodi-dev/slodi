from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime

from app.domain.enums import ContentType

from .content import ContentCreate, ContentListOut, ContentOut, ContentUpdate
from .task import TaskListOut


# Dates are optional: a bank event is a template, not a dated occurrence.
class EventCreate(ContentCreate):
    content_type: Literal[ContentType.event] = ContentType.event
    start_dt: AwareDatetime | None = None
    end_dt: AwareDatetime | None = None


class EventUpdate(ContentUpdate):
    start_dt: AwareDatetime | None = None
    end_dt: AwareDatetime | None = None
    program_id: UUID | None = None


class EventListOut(ContentListOut):
    start_dt: dt.datetime | None = None
    end_dt: dt.datetime | None = None
    program_id: UUID | None


class EventOut(ContentOut):
    start_dt: dt.datetime | None = None
    end_dt: dt.datetime | None = None
    program_id: UUID | None
    tasks: list[TaskListOut] = []
