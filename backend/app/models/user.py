from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
    validates,
)

from app.domain.user_constraints import (
    AUTH0_ID_MAX,
    AUTH0_ID_MIN,
    EMAIL_MAX,
    NAME_MAX,
    NAME_MIN,
)

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .comment import Comment
    from .content import Content
    from .group import GroupMembership
    from .workspace import WorkspaceMembership


class Pronouns(str, Enum):
    she_her = "she/her"
    he_him = "he/him"
    they_them = "they/them"
    other = "other"
    prefer_not_to_say = "prefer not to say"


class Permissions(str, Enum):
    admin = "admin"
    member = "member"
    viewer = "viewer"


class User(SoftDeleteMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("auth0_id", name="uq_users_auth0_id"),
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint(f"char_length(name) >= {NAME_MIN}", name="ck_users_name_min"),
        CheckConstraint(f"char_length(auth0_id) >= {AUTH0_ID_MIN}", name="ck_users_auth0_min"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )

    auth0_id: Mapped[str] = mapped_column(
        String(AUTH0_ID_MAX),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(NAME_MAX),
        nullable=False,
    )

    pronouns: Mapped[Pronouns | None] = mapped_column(
        SAEnum(Pronouns, name="pronouns_enum"),
        nullable=True,
    )

    email: Mapped[str] = mapped_column(
        String(EMAIL_MAX),
        nullable=False,
        index=True,
    )

    permissions: Mapped[Permissions] = mapped_column(
        SAEnum(Permissions, name="permissions_enum"),
        nullable=False,
        default=Permissions.viewer,
    )

    preferences: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Relationships
    ws_memberships: Mapped[list[WorkspaceMembership]] = relationship(back_populates="user")
    group_memberships: Mapped[list[GroupMembership]] = relationship(back_populates="user")
    authored_content: Mapped[list[Content]] = relationship(back_populates="author")
    comments: Mapped[list[Comment]] = relationship(back_populates="user")

    # Normalizers
    @validates("email")
    def _normalize_email(self, _key: str, value: str) -> str:
        return value.lower() if value is not None else value
