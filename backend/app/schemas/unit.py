from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.domain.unit_constraints import NAME_MAX, NAME_MIN

UnitName = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$", to_lower=True)]


class UnitCreate(BaseModel):
    name: UnitName
    parent_id: UUID | None = None
    color: HexColor | None = None


class UnitUpdate(BaseModel):
    name: UnitName | None = None
    parent_id: UUID | None = None
    color: HexColor | None = None


class UnitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    workspace_id: UUID
    parent_id: UUID | None
    name: str
    color: str
    deleted_at: dt.datetime | None
