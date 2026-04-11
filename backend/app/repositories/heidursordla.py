"""
Heiðursorðla repository — the only layer that touches the SQLAlchemy session.

Thin functions: each method maps to one query. The service layer composes
these into business operations and owns transaction boundaries.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import HeidursordlaAttemptStatus
from app.models.heidursordla import HeidursordlaAttempt, HeidursordlaPuzzle
from app.models.user import User
from app.repositories.base import Repository


class HeidursordlaRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    # ── puzzle reads ───────────────────────────────────────────────────────

    async def get_puzzle_by_id(self, puzzle_id: UUID) -> HeidursordlaPuzzle | None:
        stmt = select(HeidursordlaPuzzle).where(HeidursordlaPuzzle.id == puzzle_id)
        return await self.session.scalar(stmt)

    async def get_currently_live_puzzle(self, now: dt.datetime) -> HeidursordlaPuzzle | None:
        """Return the single puzzle whose ``unlocks_at <= now < locks_at``.

        The schedule guarantees rounds don't overlap, so at most one row
        matches. Returns ``None`` during off-hours and after the event ends.
        """
        stmt = (
            select(HeidursordlaPuzzle)
            .where(HeidursordlaPuzzle.unlocks_at <= now)
            .where(HeidursordlaPuzzle.locks_at > now)
            .order_by(HeidursordlaPuzzle.unlocks_at)
            .limit(1)
        )
        return await self.session.scalar(stmt)

    async def get_next_unlock_after(self, now: dt.datetime) -> dt.datetime | None:
        """Return the earliest ``unlocks_at`` strictly after ``now``.

        Used by the off-hours TodayWaiting countdown and by the play view's
        next-round countdown after a player finishes the current round.
        """
        stmt = (
            select(HeidursordlaPuzzle.unlocks_at)
            .where(HeidursordlaPuzzle.unlocks_at > now)
            .order_by(HeidursordlaPuzzle.unlocks_at)
            .limit(1)
        )
        return await self.session.scalar(stmt)

    async def list_all_puzzles(self) -> Sequence[HeidursordlaPuzzle]:
        """Return every puzzle ordered by ``puzzle_number`` — used to build
        the post-event archive view.
        """
        stmt = select(HeidursordlaPuzzle).order_by(HeidursordlaPuzzle.puzzle_number)
        return await self.scalars(stmt)

    # ── attempt reads ──────────────────────────────────────────────────────

    async def get_attempt(self, user_id: UUID, puzzle_id: UUID) -> HeidursordlaAttempt | None:
        stmt = (
            select(HeidursordlaAttempt)
            .where(HeidursordlaAttempt.user_id == user_id)
            .where(HeidursordlaAttempt.puzzle_id == puzzle_id)
        )
        return await self.session.scalar(stmt)

    async def get_attempt_for_update(
        self, user_id: UUID, puzzle_id: UUID
    ) -> HeidursordlaAttempt | None:
        """Same as :meth:`get_attempt` but takes a row-level lock so concurrent
        guess submissions for the same (user, puzzle) pair serialise.

        The caller is responsible for being inside a transaction — without
        one the FOR UPDATE clause is silently a no-op on most isolation
        levels.
        """
        stmt = (
            select(HeidursordlaAttempt)
            .where(HeidursordlaAttempt.user_id == user_id)
            .where(HeidursordlaAttempt.puzzle_id == puzzle_id)
            .with_for_update()
        )
        return await self.session.scalar(stmt)

    async def list_winners_for_leaderboard(
        self, puzzle_id: UUID, *, limit: int = 10
    ) -> Sequence[tuple[HeidursordlaAttempt, str]]:
        """Return the top ``limit`` winning attempts for ``puzzle_id``.

        Sort: fewest guesses first, then earliest finisher. Each row is a
        ``(attempt, user_name)`` tuple — joining with ``users`` here keeps
        the leaderboard query single-shot.

        Note that "fewest guesses" is computed via ``jsonb_array_length``
        on the ``guesses`` column. There's no covering index for that
        expression today; if the leaderboard becomes hot enough to matter,
        denormalise into a ``guesses_used`` column and index it.
        """
        from sqlalchemy import func

        guesses_used = func.jsonb_array_length(HeidursordlaAttempt.guesses).label("guesses_used")
        stmt = (
            select(HeidursordlaAttempt, User.name)
            .join(User, User.id == HeidursordlaAttempt.user_id)
            .where(HeidursordlaAttempt.puzzle_id == puzzle_id)
            .where(HeidursordlaAttempt.status == HeidursordlaAttemptStatus.won)
            .order_by(guesses_used.asc(), HeidursordlaAttempt.finished_at.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.all()  # type: ignore[return-value]

    # ── attempt writes ─────────────────────────────────────────────────────

    async def create_attempt_if_missing(
        self,
        *,
        user_id: UUID,
        puzzle_id: UUID,
        started_at: dt.datetime,
    ) -> None:
        """Insert a fresh in-progress attempt row, or do nothing if one already
        exists for this (user, puzzle).

        Uses Postgres ``ON CONFLICT DO NOTHING`` against the
        ``uq_heidursordla_attempts_user_puzzle`` unique constraint, so two
        racing first-guess requests can't both create attempt rows. The
        caller follows up with :meth:`get_attempt_for_update` to lock and
        mutate the row.
        """
        stmt = (
            pg_insert(HeidursordlaAttempt)
            .values(
                user_id=user_id,
                puzzle_id=puzzle_id,
                guesses=[],
                status=HeidursordlaAttemptStatus.in_progress,
                started_at=started_at,
            )
            .on_conflict_do_nothing(constraint="uq_heidursordla_attempts_user_puzzle")
        )
        await self.session.execute(stmt)
