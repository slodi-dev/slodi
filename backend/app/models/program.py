from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.program_constraints import IMG_MAX

from .content import Content, ContentType

if TYPE_CHECKING:
    from .event import Event
    from .workspace import Workspace


class Program(Content):
    __tablename__ = "programs"
    __mapper_args__ = {"polymorphic_identity": ContentType.program}
    __table_args__ = (UniqueConstraint("workspace_id", "id", name="uq_program_workspace_id_id"),)  # type: ignore[assignment]

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("content.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    image: Mapped[str | None] = mapped_column(String(IMG_MAX), nullable=True)

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    workspace: Mapped[Workspace] = relationship(back_populates="programs")
    events: Mapped[list[Event]] = relationship(
        back_populates="program",
        foreign_keys="Event.program_id",
        primaryjoin="Event.program_id == Program.id",
        cascade="all, delete-orphan",
    )
