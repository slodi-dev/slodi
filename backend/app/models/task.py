from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .content import Content, ContentType

if TYPE_CHECKING:
    from .event import Event


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

    event_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    event: Mapped[Event | None] = relationship(
        "Event",
        back_populates="tasks",
        foreign_keys=[event_id],
        primaryjoin="Task.event_id == Event.id",
    )
