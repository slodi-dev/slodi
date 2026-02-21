from __future__ import annotations

import datetime as dt
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    String,
    Time,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.workspace_constraints import (
    NAME_MAX,
    NAME_MIN,
)

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .event import Event
    from .group import Group
    from .program import Program
    from .troop import Troop
    from .user import User


class WorkspaceRole(str, Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class Weekday(str, Enum):
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"
    unknown = "unknown"


class EventInterval(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    yearly = "yearly"
    unknown = "unknown"


class Workspace(SoftDeleteMixin, Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint(f"char_length(name) >= {NAME_MIN}", name="ck_users_name_min"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )

    name: Mapped[str] = mapped_column(String(NAME_MAX), nullable=False)

    default_meeting_weekday: Mapped[Weekday] = mapped_column(
        SAEnum(Weekday, name="workspace_weekday_enum"), nullable=False
    )
    default_start_time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    default_end_time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    default_interval: Mapped[EventInterval] = mapped_column(
        SAEnum(EventInterval, name="workspace_event_interval_enum"), nullable=False
    )
    season_start: Mapped[dt.date] = mapped_column(Date, nullable=False)

    settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    group_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("groups.id"), nullable=True
    )

    # Relationships
    ws_memberships: Mapped[list[WorkspaceMembership]] = relationship(
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    group: Mapped[Group | None] = relationship(back_populates="workspaces")
    programs: Mapped[list[Program]] = relationship(
        back_populates="workspace",
        foreign_keys="Program.workspace_id",
        primaryjoin="Program.workspace_id == Workspace.id",
        cascade="all, delete-orphan",
    )
    events: Mapped[list[Event]] = relationship(
        back_populates="workspace",
        foreign_keys="Event.workspace_id",
        primaryjoin="Event.workspace_id == Workspace.id",
        cascade="all, delete-orphan",
    )
    troops: Mapped[list[Troop]] = relationship(
        back_populates="workspace",
        foreign_keys="Troop.workspace_id",
        primaryjoin="Troop.workspace_id == Workspace.id",
        cascade="all, delete-orphan",
    )


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"

    # Columns
    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    role: Mapped[WorkspaceRole] = mapped_column(
        SAEnum(WorkspaceRole, name="workspace_role_enum"),
        nullable=False,
        default=WorkspaceRole.viewer,
    )

    # Relationships
    workspace: Mapped[Workspace] = relationship(back_populates="ws_memberships")
    user: Mapped[User] = relationship(back_populates="ws_memberships")
