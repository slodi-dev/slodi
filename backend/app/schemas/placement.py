from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import AwareDatetime, BaseModel


class ContentSummary(BaseModel):
    id: UUID
    level: int
    name: str
    duration_min: int | None
    duration_max: int | None
    location: str | None
    tags: list[str]
    equipment: list[str]
    times_used: int
    hidden: bool


class PlacementOut(BaseModel):
    id: UUID
    workspace_id: UUID
    parent_id: UUID | None
    content: ContentSummary
    starts_at: dt.datetime
    ends_at: dt.datetime
    time_set: bool
    unit_ids: list[UUID]


class PlacementCreate(BaseModel):
    content_id: UUID
    parent_id: UUID | None = None
    starts_at: AwareDatetime
    ends_at: AwareDatetime | None = None
    time_set: bool = False
    unit_ids: list[UUID] = []


class PlacementUpdate(BaseModel):
    parent_id: UUID | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    time_set: bool | None = None
    unit_ids: list[UUID] | None = None


class PlacementBatchItem(PlacementUpdate):
    id: UUID
