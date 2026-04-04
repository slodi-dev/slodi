from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime as SADateTime

from .base import Base


class EmailDraft(Base):
    __tablename__ = "email_drafts"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    preheader: Mapped[str | None] = mapped_column(String(200), nullable=True)
    template: Mapped[str] = mapped_column(String(100), nullable=False)
    blocks: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    recipient_list_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    manual_recipients: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    scheduled_at: Mapped[dt.datetime | None] = mapped_column(
        SADateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[dt.datetime | None] = mapped_column(SADateTime(timezone=True), nullable=True)
    created_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime | None] = mapped_column(
        SADateTime(timezone=True), onupdate=func.now(), nullable=True
    )
