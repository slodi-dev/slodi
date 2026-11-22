from __future__ import annotations

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.domain.user_constraints import EMAIL_MAX


class EmailListCreate(BaseModel):
    email: Annotated[EmailStr, Field(max_length=EMAIL_MAX)]

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class EmailListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    unsubscribe_token: UUID


class SubscriptionStatusOut(BaseModel):
    """`changed` is False when the address was already in that state (a second click)."""

    subscribed: bool
    changed: bool
