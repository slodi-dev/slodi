from __future__ import annotations

import datetime as dt

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import DateTime as SADateTime


class SoftDeleteMixin:
    deleted_at: Mapped[dt.datetime | None] = mapped_column(
        SADateTime(timezone=True), nullable=True, default=None
    )


class Base(DeclarativeBase):
    pass
