from __future__ import annotations

from sqlalchemy import String
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
