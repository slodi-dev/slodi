from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime as SADateTime

from .base import Base


class GameSave(Base):
    """A player's saved game state, one row per user per game.

    This is a durable *backup* of state the client owns, not the authoritative
    copy: the browser keeps playing from its own local store and syncs here
    occasionally. It exists because local storage can vanish — Safari with
    cookies blocked refuses it outright, and a player lost her progress that
    way.

    ``state`` is deliberately opaque. The client owns the save format and
    already sanitises it on load; validating the shape here too would mean two
    definitions to keep in step. Size is bounded instead, so the column cannot
    become free storage.
    """

    __tablename__ = "game_saves"
    __table_args__ = (UniqueConstraint("user_id", "game_slug", name="uq_game_save_user_game"),)

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
    game_slug: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    # Client-side counter, incremented on every local save. A write only lands
    # when it is higher than the stored one, so a stale tab cannot clobber newer
    # progress. Deliberately not a timestamp — device clocks are exactly what
    # the game's offline-earnings hardening had to stop trusting.
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
