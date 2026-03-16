from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .content import Content, ContentType

if TYPE_CHECKING:
    from .event import Event
    from .program import Program


class Task(Content):
    __tablename__ = "tasks"
    __mapper_args__ = {"polymorphic_identity": ContentType.task}

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("content.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    position: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)

    event_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )

    program_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("programs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    event: Mapped[Event | None] = relationship(
        "Event",
        back_populates="tasks",
        foreign_keys=[event_id],
        primaryjoin="Task.event_id == Event.id",
    )

    program: Mapped[Program | None] = relationship(
        "Program",
        back_populates="tasks",
        foreign_keys=[program_id],
        primaryjoin="Task.program_id == Program.id",
    )
