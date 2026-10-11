from __future__ import annotations

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints, field_validator

from app.domain.user_constraints import (
    EMAIL_MAX,
)

EmailConstrained = Annotated[
    EmailStr, StringConstraints(max_length=EMAIL_MAX, strip_whitespace=True)
]


class EmailListCreate(BaseModel):
    """Fields required to create a new email list entry."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailConstrained

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        """Normalize email by stripping whitespace and lowercasing."""
        return v.strip().lower()


class EmailListOut(BaseModel):
    """Fields returned in API responses."""

    model_config = ConfigDict(from_attributes=True)

    email: EmailConstrained
    unsubscribe_token: UUID


class SubscriptionStatusOut(BaseModel):
    """Where a token's address stands after a check, unsubscribe or resubscribe.

    `changed` is False when the address was already in that state — the
    second click on an unsubscribe link, or a mail provider retrying its
    one-click POST — so the page can say "already unsubscribed" rather than
    treating it as an error.
    """

    subscribed: bool
    changed: bool
