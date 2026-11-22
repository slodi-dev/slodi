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
    """A pause on posting (skammarkrókur). `expires_at` null means open-ended."""

    __tablename__ = "posting_suspensions"
    __table_args__ = (
        CheckConstraint(
            "expires_at IS NULL OR expires_at > starts_at",
            name="ck_posting_suspensions_ends_after_start",
        ),
        Index("ix_posting_suspensions_user_id_expires_at", "user_id", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, nullable=False, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    starts_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)
    expires_at: Mapped[dt.datetime | None] = mapped_column(SADateTime(timezone=True), nullable=True)

    reason: Mapped[str] = mapped_column(String(REASON_MAX), nullable=False)

    issued_by_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    lifted_at: Mapped[dt.datetime | None] = mapped_column(SADateTime(timezone=True), nullable=True)
    lifted_by_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    lift_reason: Mapped[str | None] = mapped_column(String(REASON_MAX), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(SADateTime(timezone=True), nullable=False)

    # Relationships
    user: Mapped[User] = relationship(foreign_keys=[user_id])
    issued_by: Mapped[User | None] = relationship(foreign_keys=[issued_by_id])
    lifted_by: Mapped[User | None] = relationship(foreign_keys=[lifted_by_id])

    # Not `is_active`: the output schema has a field by that name.
    def active_at(self, now: dt.datetime) -> bool:
        if self.lifted_at is not None or self.starts_at > now:
            return False
        return self.expires_at is None or now < self.expires_at
