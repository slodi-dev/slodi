from __future__ import annotations

import datetime as dt
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime

from .base import Base


class Unit(Base):
    __tablename__ = "units"
    __table_args__ = (
        UniqueConstraint("id", "workspace_id", name="uq_units_id_workspace"),
        ForeignKeyConstraint(
            ["parent_id", "workspace_id"],
            ["units.id", "units.workspace_id"],
            ondelete="CASCADE",
            name="fk_units_parent",
        ),
        CheckConstraint("color ~ '^#[0-9a-f]{6}$'", name="ck_units_color_hex"),
        Index("ix_units_workspace_id", "workspace_id"),
        Index("ix_units_parent_id", "parent_id"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )
    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)

    # Relationships
    parent: Mapped[Unit | None] = relationship(
        remote_side=[id], foreign_keys=[parent_id], primaryjoin="Unit.parent_id == Unit.id"
    )


class UnitParticipation(Base):
    __tablename__ = "unit_participation"
    __table_args__ = (Index("ix_unit_participation_placement_id", "placement_id"),)

    unit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("units.id", ondelete="CASCADE"),
        primary_key=True,
    )
    placement_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("placements.id", ondelete="CASCADE"),
        primary_key=True,
    )
