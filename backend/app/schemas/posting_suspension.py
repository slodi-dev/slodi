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

    days: int | None = Field(None, ge=1, le=3650)
    """How long, or null for open-ended.

    A zero-day suspension is not a decision, so the floor is one. The ceiling is
    ten years — past that, "open-ended" is the honest word for what is meant,
    and it is a separate choice a reviewer has to make deliberately rather than
    reach by typing a large number."""

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
    expires_at: dt.datetime | None = None
    """Null means open-ended: it runs until somebody lifts it."""
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
