from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.group_constraints import IMG_MAX, NAME_MAX, NAME_MIN

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .user import User
    from .workspace import Workspace


class GroupRole(str, Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class Group(SoftDeleteMixin, Base):
    __tablename__ = "groups"
    __table_args__ = (
        CheckConstraint(f"char_length(name) >= {NAME_MIN}", name="ck_group_name_min"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(NAME_MAX), nullable=False)
    image: Mapped[str | None] = mapped_column(String(IMG_MAX), nullable=True)

    # Relationships
    group_memberships: Mapped[list[GroupMembership]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    workspaces: Mapped[list[Workspace]] = relationship(back_populates="group")


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    # Columns
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    group_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    role: Mapped[GroupRole] = mapped_column(
        SAEnum(GroupRole, name="group_role_enum"),
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship(back_populates="group_memberships")
    group: Mapped[Group] = relationship(back_populates="group_memberships")


@dataclass
class GroupMemberRow:
    user_id: UUID
    name: str
    role: GroupRole
