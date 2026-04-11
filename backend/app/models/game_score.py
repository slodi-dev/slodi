from __future__ import annotations

import datetime as dt
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime as SADateTime

from .base import Base


class GameScore(Base):
    __tablename__ = "game_scores"
    __table_args__ = (UniqueConstraint("user_id", "game_slug", name="uq_game_score_user_game"),)

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_name: Mapped[str] = mapped_column(String(200), nullable=False)
    game_slug: Mapped[str] = mapped_column(String(100), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    achieved_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
