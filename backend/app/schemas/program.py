from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.domain.enums import AgeGroup, ContentType, ProgramSortBy

from .content import ContentCreate, ContentListOut, ContentOut, ContentUpdate
from .event import EventListOut
from .task import TaskListOut


class ProgramFilters(BaseModel):
    search: str | None = None
    age: list[AgeGroup] | None = None
    duration_min: int | None = None
    duration_max: int | None = None
    prep_time_min: int | None = None
    prep_time_max: int | None = None
    count_min: int | None = None
    count_max: int | None = None
    price_max: int | None = None
    location: str | None = None
    equipment: list[str] | None = None
    author_id: UUID | None = None
    sort_by: ProgramSortBy | None = None


class ProgramCreate(ContentCreate):
    content_type: Literal[ContentType.program] = ContentType.program


class ProgramUpdate(ContentUpdate):
    pass


class ProgramListOut(ContentListOut):
    model_config = ConfigDict(from_attributes=True)


class ProgramOut(ContentOut):
    model_config = ConfigDict(from_attributes=True)
    events: list[EventListOut] = []
    tasks: list[TaskListOut] = []
