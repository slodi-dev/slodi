from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.tag_constraints import NAME_MAX, NAME_MIN

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .content import Content


class Tag(SoftDeleteMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (
        CheckConstraint(f"char_length(name) >= {NAME_MIN}", name="ck_tag_name_min"),
        UniqueConstraint("name", name="uq_tag_name"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, nullable=False, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(NAME_MAX), nullable=False)

    # Relationships
    content_tags: Mapped[list[ContentTag]] = relationship(
        back_populates="tag",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ContentTag(Base):
    __tablename__ = "content_tags"

    # Columns
    content_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("content.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    tag_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    # Relationships
    content: Mapped[Content] = relationship(back_populates="content_tags")
    tag: Mapped[Tag] = relationship(back_populates="content_tags")
