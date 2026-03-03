from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .content import Content, ContentType

if TYPE_CHECKING:
    from .event import Event


class Program(Content):
    __tablename__ = "programs"
    __mapper_args__ = {"polymorphic_identity": ContentType.program}

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("content.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    # Relationships
    events: Mapped[list[Event]] = relationship(
        "Event",
        back_populates="program",
        foreign_keys="Event.program_id",
        primaryjoin="Event.program_id == Program.id",
        cascade="save-update, merge",
    )
