from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    UniqueConstraint,
    false,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime

from .base import Base

if TYPE_CHECKING:
    from .content import Content


class Placement(Base):
    __tablename__ = "placements"
    __table_args__ = (
        UniqueConstraint(
            "id", "content_level", "workspace_id", name="uq_placements_id_level_workspace"
        ),
        ForeignKeyConstraint(
            ["content_id", "content_level", "workspace_id"],
            ["content.id", "content.level", "content.workspace_id"],
            onupdate="CASCADE",
            ondelete="CASCADE",
            name="fk_placements_content",
        ),
        ForeignKeyConstraint(
            ["parent_id", "parent_level", "workspace_id"],
            ["placements.id", "placements.content_level", "placements.workspace_id"],
            onupdate="CASCADE",
            ondelete="CASCADE",
            name="fk_placements_parent",
        ),
        CheckConstraint(
            "(parent_id IS NULL) = (parent_level IS NULL)", name="ck_placements_parent_has_level"
        ),
        CheckConstraint(
            "parent_level IS NULL OR content_level < parent_level",
            name="ck_placements_level_below_parent",
        ),
        CheckConstraint("ends_at >= starts_at", name="ck_placements_ends_after_start"),
        Index("ix_placements_parent_id", "parent_id"),
        Index("ix_placements_content_id", "content_id"),
        Index("ix_placements_workspace_id_starts_at", "workspace_id", "starts_at"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )
    workspace_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    content_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    content_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    parent_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    parent_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    starts_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)
    ends_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)
    time_set: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)

    # Relationships
    content: Mapped[Content] = relationship(
        foreign_keys=[content_id], primaryjoin="Placement.content_id == Content.id"
    )
    parent: Mapped[Placement | None] = relationship(
        remote_side=[id],
        foreign_keys=[parent_id],
        primaryjoin="Placement.parent_id == Placement.id",
    )
