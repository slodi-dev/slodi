"""
Heiðursorðla SQLAlchemy models.

Two tables that together implement the Saturday-only Skátaþing Heiðursorðla
event:

- ``heidursordla_puzzles`` — one row per scheduled round, seeded ahead of
  time by the curator. The pair ``(unlocks_at, locks_at)`` defines the round
  window. The puzzles table *is* the schedule — there is no runtime
  puzzle-generation logic.
- ``heidursordla_attempts`` — one row per (user, puzzle) pair. The list of
  guesses is stored as a JSONB array of ``{word, colors}`` entries; we
  reassign rather than mutate the field so SQLAlchemy notices the change.

Score writes do **not** flow into a separate cross-game ``game_scores`` table
yet — that arrives when Tengingar/Hörpuhopp ship. The leaderboard endpoint
queries ``heidursordla_attempts`` directly with ``status='won'``.
"""

from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime as SADateTime
from sqlalchemy.types import Integer

from app.domain.enums import HeidursordlaAttemptStatus
from app.domain.heidursordla_constraints import MAX_GUESSES, WORD_LENGTH

from .base import Base

if TYPE_CHECKING:
    pass


class HeidursordlaPuzzle(Base):
    __tablename__ = "heidursordla_puzzles"
    __table_args__ = (
        UniqueConstraint("puzzle_number", name="uq_heidursordla_puzzles_puzzle_number"),
        CheckConstraint(
            f"char_length(answer) = {WORD_LENGTH}",
            name="ck_heidursordla_puzzles_answer_length",
        ),
        CheckConstraint(
            "locks_at > unlocks_at",
            name="ck_heidursordla_puzzles_window_ordered",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        default=uuid4,
    )
    puzzle_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    """Human-readable round number used in the share string ("Heiðursorðla #1")."""

    answer: Mapped[str] = mapped_column(
        String(8),
        nullable=False,
    )
    """The secret word, lowercase, NFC-normalised at write time. The 8-char
    cap is forward-compat headroom; today every puzzle is exactly 5 chars
    (enforced by the CheckConstraint above)."""

    word_length: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=WORD_LENGTH,
    )

    unlocks_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
    )
    locks_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
    )


class HeidursordlaAttempt(Base):
    __tablename__ = "heidursordla_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "puzzle_id", name="uq_heidursordla_attempts_user_puzzle"),
        # Powers the leaderboard query: filter by puzzle_id + status='won',
        # sort by guesses_used ASC then finished_at ASC. Note that
        # guesses_used is derived from the JSONB array length, so we can't
        # index it directly — the puzzle_id+status+finished_at index is the
        # closest useful covering index.
        Index(
            "ix_heidursordla_attempts_puzzle_status_finished",
            "puzzle_id",
            "status",
            "finished_at",
        ),
        CheckConstraint(
            f"jsonb_array_length(guesses) <= {MAX_GUESSES}",
            name="ck_heidursordla_attempts_guess_cap",
        ),
    )

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
    puzzle_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("heidursordla_puzzles.id", ondelete="CASCADE"),
        nullable=False,
    )
    guesses: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )
    """JSONB array of ``{"word": str, "colors": [GuessColor, ...]}`` entries.

    Reassign the field rather than mutating in place — SQLAlchemy doesn't
    track in-place JSONB mutations by default and an in-place ``.append()``
    will silently not persist.
    """

    status: Mapped[HeidursordlaAttemptStatus] = mapped_column(
        SAEnum(HeidursordlaAttemptStatus, name="heidursordla_attempt_status_enum"),
        nullable=False,
        default=HeidursordlaAttemptStatus.in_progress,
    )
    started_at: Mapped[dt.datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
    )
    finished_at: Mapped[dt.datetime | None] = mapped_column(
        SADateTime(timezone=True),
        nullable=True,
    )
    """Set when ``status`` transitions to ``won`` or ``lost``. The leaderboard
    sort uses this as the tiebreaker (earliest finisher wins ties on guess
    count).
    """
