from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime

from app.domain.enums import ReviewCommentVisibility
from app.domain.review_comment_constraints import BODY_MAX

from .base import Base

if TYPE_CHECKING:
    from .content import Content
    from .user import User


class ReviewComment(Base):
    """A note a reviewer leaves on a piece of content.

    Distinct from `Comment`, which is public discussion between leaders. This is
    Dagskrárstjórnarteymið's own record: either kept between themselves, or
    addressed to the author as a suggestion.

    Not soft-deletable. A note that was sent to an author cannot be unsent, and
    an internal note is the reasoning behind a decision — both are the record.
    """

    __tablename__ = "review_comments"
    __table_args__ = (
        # The pane reads one item's notes, oldest first.
        Index("ix_review_comments_content_id_created_at", "content_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, nullable=False, default=uuid4
    )
    content_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("content.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    """The reviewer. Nullable so removing a person does not erase what they
    decided — the note survives them, credited to nobody."""

    body: Mapped[str] = mapped_column(String(BODY_MAX), nullable=False)
    visibility: Mapped[ReviewCommentVisibility] = mapped_column(
        SAEnum(
            ReviewCommentVisibility,
            name="review_comment_visibility_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    created_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)

    # Relationships
    content: Mapped[Content] = relationship(back_populates="review_comments")
    author: Mapped[User | None] = relationship(foreign_keys=[author_id])
