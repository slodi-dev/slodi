from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.enums import AgeGroup, ContentLevel, ContentType, ProgramSortBy

from .content import ContentCreate, ContentOut, ContentUpdate
from .event import EventListOut


class ProgramFilters(BaseModel):
    """The bank's query parameters. Ranges match items that overlap them; lists are OR."""

    search: str | None = Field(default=None, description="Name or description contains, any case")
    age: list[AgeGroup] | None = None
    duration_min: int | None = Field(default=None, ge=0, description="Minutes")
    duration_max: int | None = Field(default=None, ge=0, description="Minutes")
    prep_time_min: int | None = Field(default=None, ge=0, description="Minutes")
    prep_time_max: int | None = Field(default=None, ge=0, description="Minutes")
    count_min: int | None = Field(default=None, ge=0)
    count_max: int | None = Field(default=None, ge=0)
    price_max: int | None = Field(default=None, ge=0, description="ISK; 0 means free only")
    location: str | None = Field(default=None, description="Contains, any case")
    equipment: list[str] | None = None
    tags: list[str] | None = Field(default=None, description="Tag names, any case")
    author_id: UUID | None = None
    author: str | None = Field(default=None, description="Author name contains, any case")
    sort_by: ProgramSortBy | None = Field(default=None, description="Default: by name")
    level: list[ContentLevel] | None = Field(
        default=None, description="0 task, 1 event, 2 program, 3 season"
    )


class BankQuery(ProgramFilters):
    """One model for every query parameter: FastAPI only expands a query model that is alone."""

    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class ProgramCreate(ContentCreate):
    content_type: Literal[ContentType.program] = ContentType.program


class ProgramUpdate(ContentUpdate):
    pass


class ProgramOut(ContentOut):
    events: list[EventListOut] = []
