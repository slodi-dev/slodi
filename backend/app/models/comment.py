from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime

from app.domain.comment_constraints import BODY_MAX, BODY_MIN

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .content import Content
    from .user import User


class Comment(SoftDeleteMixin, Base):
    __tablename__ = "comments"
    __table_args__ = (
        Index("ix_comments_content_id_created_at", "content_id", "created_at"),
        Index("ix_comments_user_id_created_at", "user_id", "created_at"),
    )
    __table_args__ = (
        CheckConstraint(f"char_length(body) >= {BODY_MIN}", name="ck_comment_body_min"),
    )

    # Columns
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )

    body: Mapped[str] = mapped_column(String(BODY_MAX), nullable=False)

    created_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
    )

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    content_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("content.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship(back_populates="comments")
    content: Mapped[Content] = relationship(back_populates="comments")
