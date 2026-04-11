"""
Pydantic v2 schemas for the Heiðursorðla API.

These DTOs are deliberately decoupled from the SQLAlchemy models — the API
shape is allowed to evolve independently from the storage shape.

A few invariants worth knowing:

- The puzzle's secret ``answer`` is **never** included in any response while a
  player can still play. It only appears in ``GameOverOut`` (when the player
  has finished) and in archive responses (after the event ends).
- All Icelandic strings use NFC normalisation. Inbound ``GuessIn.word`` is
  *not* normalised at the schema layer — that happens in the service so we
  can also enforce ``str.strip().lower()`` and length checks together.
"""

from __future__ import annotations

import datetime as dt
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import GuessColor, HeidursordlaAttemptStatus
from app.domain.heidursordla_constraints import MAX_GUESSES, WORD_LENGTH

# ──────────────────────────────────────────────────────────────────────────
# Building blocks
# ──────────────────────────────────────────────────────────────────────────


class GuessRow(BaseModel):
    """One submitted guess and its per-letter colour vector."""

    word: str
    colors: list[GuessColor]


class PuzzleSummary(BaseModel):
    """Public-safe puzzle metadata. Never includes ``answer``."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    puzzle_number: int
    word_length: int
    unlocks_at: dt.datetime
    locks_at: dt.datetime


# ──────────────────────────────────────────────────────────────────────────
# GET /skatathing/heidursordla/today
# ──────────────────────────────────────────────────────────────────────────


class TodayActive(BaseModel):
    """Returned when a puzzle is currently live."""

    event_ended: Literal[False] = False
    puzzle: PuzzleSummary
    """The currently-live puzzle."""

    next_round_at: dt.datetime | None = None
    """Timestamp of the next round boundary, used by NextPuzzleCountdown.
    ``None`` only after the very last round of the day, in the gap before
    ``event_ended`` flips true.
    """


class TodayWaiting(BaseModel):
    """Returned during off-hours (Saturday 00:00–08:00) when no puzzle is live yet."""

    event_ended: Literal[False] = False
    puzzle: None = None
    next_round_at: dt.datetime
    """Timestamp of the next 08:00 drop. The frontend renders only the
    countdown to this moment — no grid, no keyboard.
    """


class TodayEnded(BaseModel):
    """Returned from Sunday 00:00 onward — the event is over."""

    event_ended: Literal[True] = True
    puzzles: list[ArchivePuzzle]
    """All four Saturday rounds, with answers revealed and per-puzzle
    leaderboards attached.
    """


class ArchivePuzzle(BaseModel):
    """Read-only post-event view of a single round."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    puzzle_number: int
    word_length: int
    unlocks_at: dt.datetime
    locks_at: dt.datetime
    answer: str
    leaderboard: list[LeaderboardEntry]


# ──────────────────────────────────────────────────────────────────────────
# GET /skatathing/heidursordla/{puzzle_id}
# ──────────────────────────────────────────────────────────────────────────


class PuzzleStateLocked(BaseModel):
    """Returned when ``now < puzzle.unlocks_at``. Frontend renders the locked
    countdown view.
    """

    is_unlocked: Literal[False] = False
    puzzle: PuzzleSummary


class PuzzleStateOpen(BaseModel):
    """Returned when the puzzle is currently playable, with this user's
    in-progress (or finished) attempt state for restore-on-load.
    """

    is_unlocked: Literal[True] = True
    puzzle: PuzzleSummary
    status: HeidursordlaAttemptStatus
    guesses: list[GuessRow]
    guesses_used: int
    guesses_remaining: int
    answer: str | None = None
    """Only set when ``status`` is ``won`` or ``lost`` — never leaked while
    the player can still play."""


# ──────────────────────────────────────────────────────────────────────────
# POST /skatathing/heidursordla/{puzzle_id}/guess
# ──────────────────────────────────────────────────────────────────────────


GuessWord = Annotated[
    str,
    Field(
        min_length=1,
        max_length=64,
        description="The guessed word. The backend strips, lowercases, and "
        "NFC-normalises it before any validation.",
    ),
]


class GuessIn(BaseModel):
    """Body for ``POST /{puzzle_id}/guess``."""

    word: GuessWord


class GuessOut(BaseModel):
    """Successful guess response. ``answer`` is only set on terminal status."""

    colors: list[GuessColor]
    status: HeidursordlaAttemptStatus
    guesses_used: int
    guesses_remaining: int
    answer: str | None = None


GuessErrorCode = Literal[
    "not_in_dictionary",
    "wrong_length",
    "puzzle_locked",
    "puzzle_finished",
    "attempt_finished",
    "event_ended",
]


class GuessError(BaseModel):
    """HTTP 400/410 body for guess submission failures.

    The frontend uses ``error_code`` to pick the right Icelandic toast
    message; ``detail`` is the fallback Icelandic copy if no per-code
    message is configured.
    """

    error_code: GuessErrorCode
    detail: str


# ──────────────────────────────────────────────────────────────────────────
# GET /skatathing/heidursordla/leaderboard
# ──────────────────────────────────────────────────────────────────────────


class LeaderboardEntry(BaseModel):
    """One row of the per-puzzle top-10."""

    rank: int
    user_id: UUID
    user_name: str
    guesses_used: int
    finished_at: dt.datetime
    guess_colors: list[list[GuessColor]]
    """The full per-row colour grid (no words), so the frontend can render
    the player's emoji grid alongside their score.
    """


class LeaderboardOut(BaseModel):
    """Top-N leaderboard for a single puzzle."""

    puzzle_id: UUID
    puzzle_number: int
    entries: list[LeaderboardEntry]


# Forward-ref resolution for ArchivePuzzle/LeaderboardEntry interplay.
TodayEnded.model_rebuild()
ArchivePuzzle.model_rebuild()


# Re-export the constants the frontend doesn't need but tests sometimes
# import. Keeping them out of the module's __all__ would be more polite,
# but the codebase doesn't use __all__ anywhere else either.
__all__ = (
    "ArchivePuzzle",
    "GuessError",
    "GuessErrorCode",
    "GuessIn",
    "GuessOut",
    "GuessRow",
    "LeaderboardEntry",
    "LeaderboardOut",
    "MAX_GUESSES",
    "PuzzleStateLocked",
    "PuzzleStateOpen",
    "PuzzleSummary",
    "TodayActive",
    "TodayEnded",
    "TodayWaiting",
    "WORD_LENGTH",
)
