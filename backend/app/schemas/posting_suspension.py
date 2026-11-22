from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.domain.posting_suspension_constraints import MAX_DAYS, REASON_MAX

ReasonStr = Annotated[
    str, StringConstraints(min_length=1, max_length=REASON_MAX, strip_whitespace=True)
]


class SuspensionCreate(BaseModel):
    """Putting someone in skammarkrókur."""

    model_config = ConfigDict(str_strip_whitespace=True)

    # None is open-ended, chosen deliberately rather than by typing a big number.
    days: int | None = Field(None, ge=1, le=MAX_DAYS)
    reason: ReasonStr


class SuspensionLift(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: ReasonStr


class SuspensionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    starts_at: dt.datetime
    expires_at: dt.datetime | None = None  # None: until lifted
    reason: str
    lifted_at: dt.datetime | None = None
    lift_reason: str | None = None
    issued_by_name: str | None = None
    lifted_by_name: str | None = None
    is_active: bool = False


class AuthorStanding(BaseModel):
    """Kept as separate numbers: being reported is not being wrong (strikes), and
    neither is what was done about it (suspensions)."""

    author_id: UUID
    reports_received: int
    strikes: int
    suspensions: list[SuspensionOut] = []
    active_suspension: SuspensionOut | None = None
