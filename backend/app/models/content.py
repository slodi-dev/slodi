from __future__ import annotations

import datetime as dt
import logging
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    String,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from sqlalchemy.types import DateTime as SADateTime
from sqlalchemy.types import Integer

from app.domain.content_constraints import (
    DESC_MAX,
    IMG_MAX,
    INSTRUCTIONS_MAX,
    LOCATION_MAX,
    NAME_MAX,
    NAME_MIN,
    REVIEW_NOTE_MAX,
)
from app.domain.enums import AgeGroup, ContentType, ReviewState

from .base import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from .comment import Comment
    from .content_report import ContentReport
    from .review_comment import ReviewComment
    from .tag import ContentTag, Tag
    from .user import User
    from .workspace import Workspace

logger = logging.getLogger(__name__)


class Content(SoftDeleteMixin, Base):
    __tablename__ = "content"
    __mapper_args__ = {
        "polymorphic_on": "content_type",
        "polymorphic_identity": "content",
        "with_polymorphic": "*",
    }
    __table_args__ = (
        CheckConstraint("count_min >= 0", name="ck_content_count_min_nonneg"),
        CheckConstraint("count_max >= 0", name="ck_content_count_max_nonneg"),
        CheckConstraint(
            "count_max IS NULL OR count_min IS NULL OR count_max >= count_min",
            name="ck_content_count_range",
        ),
        CheckConstraint("duration_min >= 0", name="ck_content_duration_min_nonneg"),
        CheckConstraint("duration_max >= 0", name="ck_content_duration_max_nonneg"),
        CheckConstraint(
            "duration_max IS NULL OR duration_min IS NULL OR duration_max >= duration_min",
            name="ck_content_duration_range",
        ),
        CheckConstraint("prep_time_min >= 0", name="ck_content_prep_time_min_nonneg"),
        CheckConstraint("prep_time_max >= 0", name="ck_content_prep_time_max_nonneg"),
        CheckConstraint(
            "prep_time_max IS NULL OR prep_time_min IS NULL OR prep_time_max >= prep_time_min",
            name="ck_content_prep_time_range",
        ),
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
    image: Mapped[str | None] = mapped_column(String(IMG_MAX), nullable=True)
    media: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    equipment: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    instructions: Mapped[str | None] = mapped_column(
        String(INSTRUCTIONS_MAX),
        nullable=True,
    )
    duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age: Mapped[list[AgeGroup] | None] = mapped_column(
        ARRAY(
            SAEnum(
                AgeGroup,
                name="age_group_enum",
                create_type=False,
                values_callable=lambda obj: [e.value for e in obj],
            )
        ),
        nullable=True,
    )
    location: Mapped[str | None] = mapped_column(String(LOCATION_MAX), nullable=True)
    count_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    count_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prep_time_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prep_time_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
    )

    review_state: Mapped[ReviewState] = mapped_column(
        SAEnum(
            ReviewState,
            name="review_state_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ReviewState.unreviewed,
    )
    """Whether Dagskrárstjórnarteymið has looked at this. **Not a visibility
    flag** — see `hidden_at`."""

    reviewed_by_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(
        SADateTime(timezone=True), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(String(REVIEW_NOTE_MAX), nullable=True)
    """Why it was rejected, in words the author can act on."""

    hidden_at: Mapped[dt.datetime | None] = mapped_column(SADateTime(timezone=True), nullable=True)
    """Set when a moderator takes something out of the bank.

    Deliberately the same shape as `deleted_at` on `SoftDeleteMixin`, because it
    means the same thing: not listed, not gone. Kept **separate from
    `review_state`** — the bank publishes on submit and reviews afterwards, so
    an unreviewed item is live and a rejected one is not automatically hidden.
    Fusing them would make approving the only way to make something visible,
    which turns a 3-person queue into a bottleneck on every submission."""
    author_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    workspace_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    author: Mapped[User] = relationship(
        back_populates="authored_content",
        foreign_keys=[author_id],
        primaryjoin="Content.author_id == User.id",
    )
    reviewed_by: Mapped[User | None] = relationship(
        foreign_keys=[reviewed_by_id],
        primaryjoin="Content.reviewed_by_id == User.id",
    )
    workspace: Mapped[Workspace] = relationship(
        "Workspace",
        back_populates="content_items",
        foreign_keys="Content.workspace_id",
        primaryjoin="Content.workspace_id == Workspace.id",
    )
    comments: Mapped[list[Comment]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )
    content_tags: Mapped[list[ContentTag]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )
    reports: Mapped[list[ContentReport]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )
    review_comments: Mapped[list[ReviewComment]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )

    @validates("age")
    def coerce_age(self, key: str, value: list | None) -> list[str] | None:
        """Normalize age values to the Icelandic enum value strings expected by PostgreSQL.

        Pydantic v2 model_dump() serializes StrEnum members using .name (e.g.
        "hrefnuskatar") rather than .value (e.g. "Hrefnuskátar") in Python mode.
        psycopg3 also uses .name when adapting Python enum.Enum objects.
        This validator normalizes all three possible input forms to the plain string
        values that the PostgreSQL age_group_enum type expects.
        """
        logger.info(
            "[content.py coerce_age] incoming value: %r (types: %s)",
            value,
            [type(v).__name__ for v in (value or [])],
        )
        if value is None:
            return None
        result = []
        for v in value:
            if isinstance(v, AgeGroup):
                result.append(v.value)
            else:
                try:
                    result.append(AgeGroup(v).value)  # already a valid value string
                except ValueError:
                    result.append(AgeGroup[v].value)  # a member name string
        logger.info("[content.py coerce_age] outgoing result: %r", result)
        return result

    # Properties for serialization
    @property
    def author_name(self) -> str:
        return self.author.name

    @property
    def tags(self) -> list[Tag]:
        """Return list of Tag objects from content_tags relationship"""
        return [ct.tag for ct in self.content_tags]
