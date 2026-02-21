from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .event import Event
    from .workspace import Workspace


class Troop(SoftDeleteMixin, Base):
    __tablename__ = "troops"

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    workspace: Mapped[Workspace] = relationship(back_populates="troops")
    troop_participations: Mapped[list[TroopParticipation]] = relationship(
        back_populates="troop",
        foreign_keys="TroopParticipation.troop_id",
        primaryjoin="TroopParticipation.troop_id == Troop.id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TroopParticipation(Base):
    __tablename__ = "troop_participation"

    # Columns
    troop_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("troops.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    event_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    # Relationships
    troop: Mapped[Troop] = relationship(back_populates="troop_participations")
    event: Mapped[Event] = relationship(back_populates="troop_participations")
