from __future__ import annotations

from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field

from .content import ContentOut
from .placement import PlacementOut


class CopyCreate(BaseModel):
    source_id: UUID
    reuse: dict[UUID, UUID] = Field(
        default={}, description="Source id → your existing copy; anything not listed is copied"
    )
    parent_id: UUID | None = None
    starts_at: AwareDatetime | None = None


class CopyOut(BaseModel):
    content: ContentOut
    placements: list[PlacementOut]


class AlreadyHave(BaseModel):
    source_id: UUID
    existing_id: UUID
    name: str


class CopyPreview(BaseModel):
    already_have: list[AlreadyHave]


class PlacementCopies(BaseModel):
    starts_at: list[AwareDatetime] = Field(min_length=1, max_length=100)
    parent_id: UUID | None = None
