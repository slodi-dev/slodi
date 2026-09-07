from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.domain.posting_suspension_constraints import REASON_MAX

ReasonStr = Annotated[
    str, StringConstraints(min_length=1, max_length=REASON_MAX, strip_whitespace=True)
]


class SuspensionCreate(BaseModel):
    """Putting someone in skammarkrókur."""

    model_config = ConfigDict(str_strip_whitespace=True)

    days: int = Field(..., ge=1, le=3650)
    """How long. Bounded on both ends: a suspension of zero days is not a
    decision, and an unbounded one is a ban by another name."""

    reason: ReasonStr
    """Required. Someone told they cannot contribute deserves to know why, and a
    reviewer who cannot articulate it probably should not be doing it."""


class SuspensionLift(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: ReasonStr


class SuspensionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    starts_at: dt.datetime
    expires_at: dt.datetime
    reason: str
    lifted_at: dt.datetime | None = None
    lift_reason: str | None = None
    issued_by_name: str | None = None
    lifted_by_name: str | None = None
    is_active: bool = False


class AuthorStanding(BaseModel):
    """What a reviewer needs to know about a person before deciding.

    Deliberately three separate numbers. Reports received is context — anyone
    can be reported. Strikes are moderator decisions. Suspensions are what was
    done about them. Collapsing these into one "trust score" would hide the
    difference between being complained about and being wrong.
    """

    author_id: UUID
    reports_received: int
    strikes: int
    suspensions: list[SuspensionOut] = []
    active_suspension: SuspensionOut | None = None
