from __future__ import annotations

import datetime as dt
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.user_constraints import (
    EMAIL_MAX,
)

from .base import Base


class EmailList(Base):
    __tablename__ = "emaillist"

    # Columns
    email: Mapped[str] = mapped_column(
        String(EMAIL_MAX),
        nullable=False,
        primary_key=True,
    )
    unsubscribe_token: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid4,
    )
    #: Set when the address unsubscribes. The row is kept rather than deleted
    #: so the token keeps working: a second click, or a mail provider retrying
    #: its one-click POST, is told "already unsubscribed" instead of 404, and
    #: the address can resubscribe from the same link. Every send reads only
    #: rows where this is null.
    unsubscribed_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
