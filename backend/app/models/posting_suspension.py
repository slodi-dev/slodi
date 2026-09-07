from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime as SADateTime

from app.domain.posting_suspension_constraints import REASON_MAX

from .base import Base

if TYPE_CHECKING:
    from .user import User


class PostingSuspension(Base):
    """A timed pause on someone's ability to submit — the skammarkrókur.

    **A table, not columns on `User`, because the history is the point.** "Third
    time this year" is exactly what a reviewer needs to know before deciding,
    and a boolean or a single expiry date loses it the moment the second one
    starts.

    Bounded: every suspension has an end. An indefinite one is a ban by another
    name, and banning an adult volunteer from a movement is not a decision this
    screen should be able to make quietly.
    """

    __tablename__ = "posting_suspensions"
    __table_args__ = (
        CheckConstraint("expires_at > starts_at", name="ck_posting_suspensions_ends_after_start"),
        # "Is this person suspended right now?" runs on every write they attempt.
        Index("ix_posting_suspensions_user_id_expires_at", "user_id", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, nullable=False, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    starts_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)
    expires_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)

    reason: Mapped[str] = mapped_column(String(REASON_MAX), nullable=False)
    """Required. Someone told they cannot contribute deserves to know why, and a
    reviewer who cannot articulate it probably should not be doing it."""

    issued_by_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    lifted_at: Mapped[dt.datetime | None] = mapped_column(SADateTime(timezone=True), nullable=True)
    lifted_by_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    lift_reason: Mapped[str | None] = mapped_column(String(REASON_MAX), nullable=True)
    """Lifting early is a separate act from issuing, and the record should show
    both — a suspension that was reconsidered is not the same as one that ran."""

    created_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)

    # Relationships
    user: Mapped[User] = relationship(foreign_keys=[user_id])
    issued_by: Mapped[User | None] = relationship(foreign_keys=[issued_by_id])
    lifted_by: Mapped[User | None] = relationship(foreign_keys=[lifted_by_id])

    def active_at(self, now: dt.datetime) -> bool:
        """Running at `now`: started, not expired, not lifted early.

        Not named `is_active`: the output schema has a field by that name, and
        validating straight off the model read the bound method instead.
        """
        return self.lifted_at is None and self.starts_at <= now < self.expires_at
