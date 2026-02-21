from __future__ import annotations

import datetime as dt
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    String,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime
from sqlalchemy.types import Integer

from app.domain.content_constraints import (
    AGE_MAX,
    DESC_MAX,
    DURATION_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
)

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .comment import Comment
    from .tag import ContentTag
    from .user import User


class ContentType(str, Enum):
    program = "program"
    event = "event"
    task = "task"


class Content(SoftDeleteMixin, Base):
    __tablename__ = "content"
    __mapper_args__ = {
        "polymorphic_on": "content_type",
        "polymorphic_identity": "content",
        "with_polymorphic": "*",
    }
    __table_args__ = (
        CheckConstraint("like_count >= 0", name="ck_content_like_nonneg"),
        CheckConstraint("count >= 0", name="ck_content_count_nonneg"),
        CheckConstraint("price >= 0", name="ck_content_price_nonneg"),
        CheckConstraint(f"char_length(name) >= {NAME_MIN}", name="ck_content_name_min"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )
    content_type: Mapped[ContentType] = mapped_column(
        SAEnum(ContentType, name="content_type_enum"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(NAME_MAX), nullable=False)
    description: Mapped[str | None] = mapped_column(String(DESC_MAX), nullable=True)
    equipment: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    instructions: Mapped[str | None] = mapped_column(
        String(INSTRUCTIONS_MAX),
        nullable=True,
    )
    duration: Mapped[str | None] = mapped_column(String(DURATION_MAX), nullable=True)
    age: Mapped[str | None] = mapped_column(String(AGE_MAX), nullable=True)
    location: Mapped[str | None] = mapped_column(String(LOCATION_MAX), nullable=True)
    count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prep_time: Mapped[str | None] = mapped_column(String(DURATION_MAX), nullable=True)
    like_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
    )
    author_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # Relationships
    author: Mapped[User] = relationship(back_populates="authored_content")
    comments: Mapped[list[Comment]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )
    content_tags: Mapped[list[ContentTag]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )

    # Properties for serialization
    @property
    def tags(self):
        """Return list of Tag objects from content_tags relationship"""
        return [ct.tag for ct in self.content_tags]

    @property
    def comment_count(self) -> int:
        """Return count of comments for this content"""
        return len(self.comments) if self.comments else 0
