from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, field_validator

from app.domain.enums import ContentType

from .content import ContentCreate, ContentListOut, ContentOut, ContentUpdate
from .task import TaskListOut


def _ensure_tzaware(value: dt.datetime, field: str) -> dt.datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError(f"{field} must be timezone-aware")
    return value


class EventCreate(ContentCreate):
    content_type: Literal[ContentType.event] = ContentType.event

    # No default. The previous `default_factory=get_current_datetime` meant an
    # omitted start_dt silently became "now", so every bank submission carried a
    # timestamp its author never chose — the one field a create form deliberately
    # does not ask for.
    start_dt: dt.datetime | None = None
    end_dt: dt.datetime | None = None

    @field_validator("start_dt")
    @classmethod
    def _tz_start(cls, v: dt.datetime | None) -> dt.datetime | None:
        if v is None:
            return v
        return _ensure_tzaware(v, "start_dt")

    @field_validator("end_dt")
    @classmethod
    def _tz_end(cls, v: dt.datetime | None) -> dt.datetime | None:
        if v is None:
            return v
        return _ensure_tzaware(v, "end_dt")


class EventUpdate(ContentUpdate):
    start_dt: dt.datetime | None = None
    end_dt: dt.datetime | None = None
    program_id: UUID | None = None

    @field_validator("start_dt")
    @classmethod
    def _tz_start(cls, v: dt.datetime | None) -> dt.datetime | None:
        if v is None:
            return v
        return _ensure_tzaware(v, "start_dt")

    @field_validator("end_dt")
    @classmethod
    def _tz_end(cls, v: dt.datetime | None) -> dt.datetime | None:
        if v is None:
            return v
        return _ensure_tzaware(v, "end_dt")


class EventListOut(ContentListOut):
    model_config = ConfigDict(from_attributes=True)

    # Null for a bank template — see EventCreate. Reading one back must not 500.
    start_dt: dt.datetime | None = None
    end_dt: dt.datetime | None = None
    program_id: UUID | None


class EventOut(ContentOut):
    model_config = ConfigDict(from_attributes=True)

    # Null for a bank template — see EventCreate. Reading one back must not 500.
    start_dt: dt.datetime | None = None
    end_dt: dt.datetime | None = None
    program_id: UUID | None
    tasks: list[TaskListOut] = []
