from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, ForeignKeyConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime

from .content import Content, ContentType

if TYPE_CHECKING:
    from .program import Program
    from .task import Task
    from .troop import TroopParticipation
    from .workspace import Workspace


class Event(Content):
    __tablename__ = "events"
    __mapper_args__ = {"polymorphic_identity": ContentType.event}
    __table_args__ = (  # type: ignore[assignment]
        ForeignKeyConstraint(
            ["workspace_id", "program_id"],
            ["programs.workspace_id", "programs.id"],
            name="fk_event_program_workspace_program",
            ondelete="RESTRICT",
            deferrable=True,
            initially="DEFERRED",
        ),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("content.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    start_dt: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)
    end_dt: Mapped[dt.datetime | None] = mapped_column(SADateTime(timezone=True), nullable=True)

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    program_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # Relationships
    tasks: Mapped[list[Task]] = relationship(
        "Task",
        back_populates="event",
        foreign_keys="Task.event_id",
        primaryjoin="Task.event_id == Event.id",
        cascade="all, delete-orphan",
    )

    workspace: Mapped[Workspace] = relationship(
        back_populates="events",
        foreign_keys="Event.workspace_id",
        primaryjoin="Event.workspace_id == Workspace.id",
    )

    program: Mapped[Program] = relationship(
        back_populates="events",
        foreign_keys="Event.program_id",
        primaryjoin="Event.program_id == Program.id",
    )

    troop_participations: Mapped[list[TroopParticipation]] = relationship(
        back_populates="event",
        foreign_keys="TroopParticipation.event_id",
        primaryjoin="TroopParticipation.event_id == Event.id",
        cascade="all, delete-orphan",
    )
