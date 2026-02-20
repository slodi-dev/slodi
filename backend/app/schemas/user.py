from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints, field_validator

from app.domain.user_constraints import (
    AUTH0_ID_MAX,
    AUTH0_ID_MIN,
    EMAIL_MAX,
    NAME_MAX,
    NAME_MIN,
)
from app.models.user import Permissions, Pronouns

Auth0Id = Annotated[
    str,
    StringConstraints(min_length=AUTH0_ID_MIN, max_length=AUTH0_ID_MAX, strip_whitespace=True),
]
NameStr = Annotated[
    str,
    StringConstraints(min_length=NAME_MIN, max_length=NAME_MAX, strip_whitespace=True),
]

EmailConstrained = Annotated[
    EmailStr, StringConstraints(max_length=EMAIL_MAX, strip_whitespace=True)
]


class UserBase(BaseModel):
    """Shared properties across user models."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: NameStr
    pronouns: Pronouns | None = None
    permissions: Permissions = Permissions.viewer
    preferences: dict[str, Any] | None = None


class UserCreate(UserBase):
    """Payload for creating a user."""

    auth0_id: Auth0Id
    email: EmailConstrained

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        """Normalize email by stripping whitespace and lowercasing."""
        return v.strip().lower()


class UserUpdateAdmin(BaseModel):
    """Payload for updating a user. All fields optional."""

    name: NameStr | None = None
    pronouns: Pronouns | None = None
    permissions: Permissions | None = None
    preferences: dict[str, Any] | None = None
    email: EmailConstrained | None = None
    auth0_id: Auth0Id | None = None

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, v: str | None) -> str | None:
        return v.strip().lower() if isinstance(v, str) else v


class UserUpdateSelf(BaseModel):
    """Payload for updating own user profile. Only allows updating name and pronouns."""

    name: NameStr | None = None
    pronouns: Pronouns | None = None


class UserOut(UserBase):
    """Fields returned in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailConstrained
    auth0_id: Auth0Id
    name: NameStr


