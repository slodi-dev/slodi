from __future__ import annotations

import datetime as dt
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.domain.enums import EventInterval, Weekday, WorkspaceRole
from app.domain.workspace_constraints import (
    NAME_MAX,
    NAME_MIN,
)

NameStr = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]


def get_first_monday_of_september() -> dt.date:
    year = dt.date.today().year
    september_first = dt.date(year, 9, 1)
    days_to_monday = (7 - september_first.weekday()) % 7
    return september_first + dt.timedelta(days=days_to_monday)


# ---- Workspace ----


class WorkspaceBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr
    default_meeting_weekday: Weekday = Weekday.monday
    default_start_time: dt.time = dt.time(hour=20, minute=0)
    default_end_time: dt.time = dt.time(hour=21, minute=30)
    default_interval: EventInterval = EventInterval.weekly
    season_start: dt.date = Field(default_factory=get_first_monday_of_september)
    settings: dict[str, Any] | None = None
    group_id: UUID | None = None


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr | None = None
    default_meeting_weekday: Weekday | None = None
    default_start_time: dt.time | None = None
    default_end_time: dt.time | None = None
    default_interval: EventInterval | None = None
    season_start: dt.date | None = None
    settings: dict[str, Any] | None = None
    group_id: UUID | None = None


class WorkspaceOut(WorkspaceBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class WorkspaceNested(BaseModel):
    """Minimal workspace info for embedding in other schemas."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: NameStr


# ---- WorkspaceMembership ----


class WorkspaceMembershipBase(BaseModel):
    role: WorkspaceRole = WorkspaceRole.viewer


class WorkspaceMembershipCreate(WorkspaceMembershipBase):
    workspace_id: UUID
    user_id: UUID


class WorkspaceMembershipUpdate(BaseModel):
    role: WorkspaceRole


class WorkspaceMembershipOut(WorkspaceMembershipBase):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: UUID
    user_id: UUID
