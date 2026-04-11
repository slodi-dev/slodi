"""
Heiðursorðla business logic.

Owns the rules of the game, the dictionary loading, the NFC normalisation
that's load-bearing for Icelandic input, and the row-locked guess flow that
serialises concurrent submissions for the same (user, puzzle).

The dictionary is loaded **once at module import**, into a module-level
``frozenset[str]``. The cost is a few hundred KB and a one-time scan of
~25,000 lines. Lookups are O(1) and there is no DB or HTTP hit per guess.

NFC normalisation happens in three places — the dictionary load (here), the
puzzle answer write (in the migration / future seed scripts), and the
incoming guess validation (also here, in :meth:`HeidursordlaService.submit_guess`
before any length check or dictionary lookup). If we miss any one of these,
players whose phone keyboards send NFD will see all their guesses bounce as
"Ekki í orðabók" and have no idea why.
"""

from __future__ import annotations

import datetime as dt
import logging
import unicodedata
from functools import lru_cache
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import GuessColor, HeidursordlaAttemptStatus
from app.domain.heidursordla_constraints import (
    DICTIONARY_PATH,
    EVENT_END_AT,
    ICELAND_TZ,
    MAX_GUESSES,
    WORD_LENGTH,
)
from app.models.heidursordla import HeidursordlaPuzzle
from app.repositories.heidursordla import HeidursordlaRepository
from app.schemas.heidursordla import (
    ArchivePuzzle,
    GuessError,
    GuessOut,
    GuessRow,
    LeaderboardEntry,
    LeaderboardOut,
    PuzzleStateLocked,
    PuzzleStateOpen,
    PuzzleSummary,
    TodayActive,
    TodayEnded,
    TodayWaiting,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────
# Dictionary loading (module-level singleton)
# ──────────────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _load_dictionary() -> frozenset[str]:
    """Read ``icelandic_5_letter_words.txt`` into a frozenset, NFC-normalising
    every entry. Cached forever via ``lru_cache(maxsize=1)``.

    Validation: every retained entry must be exactly :data:`WORD_LENGTH`
    characters after normalisation. Lines that fail this check, blank lines,
    and ``#``-prefixed comment lines are skipped with a warning rather than
    crashing the worker.
    """
    if not DICTIONARY_PATH.is_file():
        raise RuntimeError(
            f"Heiðursorðla dictionary file not found at {DICTIONARY_PATH}. "
            "Did you forget to commit backend/app/data/icelandic_5_letter_words.txt?"
        )

    words: set[str] = set()
    skipped = 0
    with DICTIONARY_PATH.open(encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            normalised = unicodedata.normalize("NFC", line.lower())
            if len(normalised) != WORD_LENGTH:
                skipped += 1
                continue
            words.add(normalised)

    logger.info(
        "Heiðursorðla dictionary loaded: %d words (%d skipped) from %s",
        len(words),
        skipped,
        DICTIONARY_PATH,
    )
    return frozenset(words)


def _normalise_word(raw: str) -> str:
    """The single canonical normaliser for any string we treat as a word."""
    return unicodedata.normalize("NFC", raw.strip().lower())


# ──────────────────────────────────────────────────────────────────────────
# Color computation
# ──────────────────────────────────────────────────────────────────────────


def compute_colors(guess: str, answer: str) -> list[GuessColor]:
    """Wordle-style two-pass colour computation.

    Pass 1: mark every exact-position match as ``green``. Track which
    positions in the *answer* have been "consumed" by a green hit.

    Pass 2: for each remaining (non-green) guess letter, look for an
    unconsumed matching letter elsewhere in the answer; mark it ``yellow``
    if found, ``gray`` otherwise.

    The two passes prevent the duplicate-letter trap: with answer
    ``"speed"`` and guess ``"creep"``, only one of the two ``e``s in the
    guess gets a colour — the second one is gray, not yellow.

    Both inputs are expected to be NFC-normalised, lowercased, and the same
    length. The caller is responsible for that.
    """
    assert len(guess) == len(answer), "compute_colors: lengths must match"
    colors: list[GuessColor | None] = [None] * len(guess)
    answer_chars: list[str | None] = list(answer)

    # Pass 1: greens
    for i, ch in enumerate(guess):
        if ch == answer_chars[i]:
            colors[i] = GuessColor.green
            answer_chars[i] = None  # consume

    # Pass 2: yellows / grays
    for i, ch in enumerate(guess):
        if colors[i] is not None:
            continue
        try:
            j = answer_chars.index(ch)
        except ValueError:
            colors[i] = GuessColor.gray
        else:
            colors[i] = GuessColor.yellow
            answer_chars[j] = None  # consume

    # All cells filled by construction — narrow the type.
    return [c for c in colors if c is not None]


# ──────────────────────────────────────────────────────────────────────────
# Service
# ──────────────────────────────────────────────────────────────────────────


def _now() -> dt.datetime:
    """All time comparisons go through here so tests can monkeypatch a single
    function instead of every call site.
    """
    return dt.datetime.now(tz=ICELAND_TZ)


def _is_event_ended(now: dt.datetime) -> bool:
    return now >= EVENT_END_AT


def _to_summary(puzzle: HeidursordlaPuzzle) -> PuzzleSummary:
    return PuzzleSummary.model_validate(puzzle)


def _row_from_dict(d: dict) -> GuessRow:
    """Convert a JSONB ``{"word": ..., "colors": [...]}`` dict to a GuessRow.

    Tolerates string colour values from older rows by coercing through
    ``GuessColor``.
    """
    return GuessRow(word=d["word"], colors=[GuessColor(c) for c in d["colors"]])


class HeidursordlaService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = HeidursordlaRepository(session)
        # Touch the cache so any startup-time failure surfaces here, not on
        # the first guess.
        _load_dictionary()

    # ── /today ────────────────────────────────────────────────────────────

    async def get_today(self) -> TodayActive | TodayWaiting | TodayEnded:
        now = _now()

        if _is_event_ended(now):
            puzzles = await self.repo.list_all_puzzles()
            archives: list[ArchivePuzzle] = []
            for p in puzzles:
                leaderboard = await self.get_leaderboard(p.id, limit=10)
                archives.append(
                    ArchivePuzzle(
                        id=p.id,
                        puzzle_number=p.puzzle_number,
                        word_length=p.word_length,
                        unlocks_at=p.unlocks_at,
                        locks_at=p.locks_at,
                        answer=p.answer,
                        leaderboard=leaderboard.entries,
                    )
                )
            return TodayEnded(puzzles=archives)

        live = await self.repo.get_currently_live_puzzle(now)
        next_unlock = await self.repo.get_next_unlock_after(now)

        if live is None:
            # Off-hours (Saturday 00:00–10:30) or between rounds. There
            # should always be a future unlock during the event window;
            # fall back to EVENT_END_AT for the rare gap right before the
            # event ends.
            return TodayWaiting(next_round_at=next_unlock or EVENT_END_AT)

        return TodayActive(
            puzzle=_to_summary(live),
            next_round_at=next_unlock,
        )

    # ── /{puzzle_id} ──────────────────────────────────────────────────────

    async def get_puzzle_state(
        self, puzzle_id: UUID, user_id: UUID
    ) -> PuzzleStateLocked | PuzzleStateOpen:
        puzzle = await self.repo.get_puzzle_by_id(puzzle_id)
        if puzzle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Þraut fannst ekki",
            )

        now = _now()
        if now < puzzle.unlocks_at:
            return PuzzleStateLocked(puzzle=_to_summary(puzzle))

        attempt = await self.repo.get_attempt(user_id, puzzle_id)
        if attempt is None:
            return PuzzleStateOpen(
                puzzle=_to_summary(puzzle),
                status=HeidursordlaAttemptStatus.in_progress,
                guesses=[],
                guesses_used=0,
                guesses_remaining=MAX_GUESSES,
                answer=None,
            )

        rows = [_row_from_dict(d) for d in attempt.guesses]
        is_finished = attempt.status != HeidursordlaAttemptStatus.in_progress
        return PuzzleStateOpen(
            puzzle=_to_summary(puzzle),
            status=attempt.status,
            guesses=rows,
            guesses_used=len(rows),
            guesses_remaining=MAX_GUESSES - len(rows),
            answer=puzzle.answer if is_finished else None,
        )

    # ── POST /{puzzle_id}/guess ───────────────────────────────────────────

    async def submit_guess(
        self,
        *,
        puzzle_id: UUID,
        user_id: UUID,
        raw_word: str,
    ) -> GuessOut:
        """Validate, score, persist, and return one guess.

        Concurrency: the read of the attempt row uses ``SELECT ... FOR
        UPDATE`` so two requests racing for the same (user, puzzle) pair
        serialise on the row lock. The first request through inserts the
        row via ``ON CONFLICT DO NOTHING``; both requests then take the
        lock in turn.
        """
        # 1. Event-ended cutoff (HTTP 410).
        now = _now()
        if _is_event_ended(now):
            raise self._guess_error(
                code="event_ended",
                detail="Skátaþingsorðlu er lokið",
                http_status=status.HTTP_410_GONE,
            )

        # 2. Normalise input. This is the *only* place ``_normalise_word``
        #    runs on inbound user input — every downstream comparison
        #    assumes NFC + lowercased + stripped.
        word = _normalise_word(raw_word)

        # 3. Length check.
        if len(word) != WORD_LENGTH:
            raise self._guess_error(
                code="wrong_length",
                detail=f"Orðið verður að vera {WORD_LENGTH} stafir",
            )

        # 4. Dictionary check.
        if word not in _load_dictionary():
            raise self._guess_error(
                code="not_in_dictionary",
                detail="Ekki í orðabók",
            )

        # 5. Load the puzzle and check the window.
        puzzle = await self.repo.get_puzzle_by_id(puzzle_id)
        if puzzle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Þraut fannst ekki",
            )
        if now < puzzle.unlocks_at:
            raise self._guess_error(
                code="puzzle_locked",
                detail="Þrautin er ekki opin enn",
            )
        if now >= puzzle.locks_at:
            raise self._guess_error(
                code="puzzle_finished",
                detail="Þessi þraut er lokið",
            )

        # 6. Ensure the attempt row exists, then take the row lock.
        await self.repo.create_attempt_if_missing(
            user_id=user_id,
            puzzle_id=puzzle_id,
            started_at=now,
        )
        attempt = await self.repo.get_attempt_for_update(user_id, puzzle_id)
        # The create_attempt_if_missing call guarantees this is non-None.
        assert attempt is not None

        # 7. Has the player already finished this puzzle?
        if attempt.status != HeidursordlaAttemptStatus.in_progress:
            raise self._guess_error(
                code="attempt_finished",
                detail="Þú hefur þegar lokið þessari þraut",
            )

        # 8. Has the player run out of guesses? (Defensive — the check below
        #    transitions to 'lost' on the 6th guess, so this branch only
        #    fires if the row is somehow already at MAX_GUESSES with status
        #    still in_progress.)
        if len(attempt.guesses) >= MAX_GUESSES:
            raise self._guess_error(
                code="attempt_finished",
                detail="Þú hefur þegar lokið þessari þraut",
            )

        # 9. Score the guess and persist.
        answer = puzzle.answer  # already NFC at write time
        colors = compute_colors(word, answer)
        new_guess: dict = {"word": word, "colors": [c.value for c in colors]}

        # JSONB mutation tracking: reassign rather than .append, otherwise
        # SQLAlchemy may not flush the change.
        attempt.guesses = [*attempt.guesses, new_guess]

        is_win = word == answer
        is_loss = (not is_win) and len(attempt.guesses) >= MAX_GUESSES

        if is_win:
            attempt.status = HeidursordlaAttemptStatus.won
            attempt.finished_at = now
        elif is_loss:
            attempt.status = HeidursordlaAttemptStatus.lost
            attempt.finished_at = now

        await self.session.commit()
        await self.session.refresh(attempt)

        return GuessOut(
            colors=colors,
            status=attempt.status,
            guesses_used=len(attempt.guesses),
            guesses_remaining=MAX_GUESSES - len(attempt.guesses),
            answer=answer if attempt.status != HeidursordlaAttemptStatus.in_progress else None,
        )

    # ── /leaderboard ──────────────────────────────────────────────────────

    async def get_leaderboard(self, puzzle_id: UUID, *, limit: int = 10) -> LeaderboardOut:
        puzzle = await self.repo.get_puzzle_by_id(puzzle_id)
        if puzzle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Þraut fannst ekki",
            )

        rows = await self.repo.list_winners_for_leaderboard(puzzle_id, limit=limit)
        entries: list[LeaderboardEntry] = []
        for rank, (attempt, user_name) in enumerate(rows, start=1):
            colors_grid = [[GuessColor(c) for c in row["colors"]] for row in attempt.guesses]
            entries.append(
                LeaderboardEntry(
                    rank=rank,
                    user_id=attempt.user_id,
                    user_name=user_name,
                    guesses_used=len(attempt.guesses),
                    # finished_at is non-null because we filtered by status='won'.
                    finished_at=attempt.finished_at,  # type: ignore[arg-type]
                    guess_colors=colors_grid,
                )
            )

        return LeaderboardOut(
            puzzle_id=puzzle_id,
            puzzle_number=puzzle.puzzle_number,
            entries=entries,
        )

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _guess_error(
        *,
        code: str,
        detail: str,
        http_status: int = status.HTTP_400_BAD_REQUEST,
    ) -> HTTPException:
        """Build an HTTPException whose body is a typed :class:`GuessError`.

        FastAPI serialises the dict in ``detail`` directly into the response
        body, so the frontend gets ``{"error_code": "...", "detail": "..."}``
        and can match on ``error_code`` to pick the right toast.
        """
        body = GuessError.model_validate({"error_code": code, "detail": detail})
        return HTTPException(status_code=http_status, detail=body.model_dump())
