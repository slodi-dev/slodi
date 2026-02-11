from __future__ import annotations

import datetime as dt
from typing import Annotated, Literal
from uuid import UUID

from pydantic import ConfigDict, Field, StringConstraints, field_validator

from app.domain.event_constraints import LOCATION_MAX
from app.models.content import ContentType
from app.utils import get_current_datetime

from .content import ContentCreate, ContentOut, ContentUpdate
from .workspace import WorkspaceNested  # Import for nested workspace

# Rebuild model to resolve forward references
ContentOut.model_rebuild()

LocationStr = Annotated[str, StringConstraints(max_length=LOCATION_MAX, strip_whitespace=True)]


def _ensure_tzaware(value: dt.datetime, field: str) -> dt.datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError(f"{field} must be timezone-aware")
    return value


class EventCreate(ContentCreate):
    content_type: Literal[ContentType.event] = ContentType.event

    start_dt: dt.datetime = Field(default_factory=get_current_datetime)
    end_dt: dt.datetime | None = None
    location: LocationStr | None = None

    @field_validator("start_dt")
    @classmethod
    def _tz_start(cls, v: dt.datetime) -> dt.datetime:
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
    location: LocationStr | None = None
    workspace_id: UUID | None = None
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


class EventOut(ContentOut):
    model_config = ConfigDict(from_attributes=True)

    start_dt: dt.datetime
    end_dt: dt.datetime | None = None
    location: LocationStr | None = None
    workspace_id: UUID
    workspace: WorkspaceNested
    program_id: UUID | None
