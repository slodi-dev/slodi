"""
Heiðursorðla HTTP routes for the Saturday-only Skátaþing 2026 event.

All four endpoints are auth-required (Auth0 JWT via :func:`get_current_user`).
The hard login wall is also enforced one layer up by the Next.js Auth0
middleware on ``/skatathing/*``, but the backend belt-and-braces it.

Route declaration order matters: the literal paths (``/today``,
``/leaderboard``) come **before** ``/{puzzle_id}`` so FastAPI doesn't try to
parse "today" as a UUID.

A note on error response shape: FastAPI wraps any ``HTTPException.detail``
inside a ``{"detail": ...}`` envelope. When the service raises a typed guess
error, the response body is therefore ``{"detail": {"error_code": "...",
"detail": "..."}}`` — the frontend reads ``body.detail.error_code`` to pick
the right Icelandic toast.
"""

# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_session
from app.core.rate_limiter import user_rate_limit
from app.schemas.heidursordla import (
    GuessIn,
    GuessOut,
    LeaderboardOut,
    PuzzleStateLocked,
    PuzzleStateOpen,
    TodayActive,
    TodayEnded,
    TodayWaiting,
)
from app.schemas.user import UserOut
from app.services.heidursordla import HeidursordlaService

router = APIRouter(
    prefix="/leikir/heidursordla",
    tags=["heidursordla"],
)
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# ── /today ─────────────────────────────────────────────────────────────────


@router.get(
    "/today",
    response_model=TodayActive | TodayWaiting | TodayEnded,
)
async def get_today(
    session: SessionDep,
    current_user: UserOut = Depends(get_current_user),
) -> TodayActive | TodayWaiting | TodayEnded:
    """Return whichever of three states the event is in right now:

    - **TodayActive** — a puzzle is currently live (08:00 → 24:00 Saturday)
    - **TodayWaiting** — off-hours; render only the countdown to next 08:00
    - **TodayEnded** — Sunday 00:00 onward; render the archive view with all
      four locked puzzles, their answers, and per-round leaderboards
    """
    svc = HeidursordlaService(session)
    return await svc.get_today()


# ── /leaderboard ───────────────────────────────────────────────────────────


@router.get(
    "/leaderboard",
    response_model=LeaderboardOut,
)
async def get_leaderboard(
    session: SessionDep,
    puzzle_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: int = 10,
) -> LeaderboardOut:
    """Top-N leaderboard for a single puzzle.

    Sort: ``guesses_used ASC, finished_at ASC`` — fewest guesses wins; ties
    broken by who finished first. Each entry includes the player's full
    colour grid (no words) so the frontend can render an emoji grid
    alongside the score.
    """
    svc = HeidursordlaService(session)
    # Cap limit at a sensible maximum so leaderboard queries can't be abused
    # to scan thousands of attempts.
    safe_limit = max(1, min(limit, 100))
    return await svc.get_leaderboard(puzzle_id, limit=safe_limit)


# ── /{puzzle_id} ───────────────────────────────────────────────────────────


@router.get(
    "/{puzzle_id}",
    response_model=PuzzleStateLocked | PuzzleStateOpen,
)
async def get_puzzle_state(
    session: SessionDep,
    puzzle_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> PuzzleStateLocked | PuzzleStateOpen:
    """Return the puzzle's metadata and (if unlocked) the user's attempt
    state for restore-on-load.

    If the puzzle hasn't unlocked yet, returns the locked-countdown shape
    (``is_unlocked: false``) — the frontend renders only the countdown.
    """
    svc = HeidursordlaService(session)
    return await svc.get_puzzle_state(puzzle_id, current_user.id)


# ── POST /{puzzle_id}/guess ────────────────────────────────────────────────


@router.post(
    "/{puzzle_id}/guess",
    response_model=GuessOut,
    status_code=status.HTTP_200_OK,
)
async def submit_guess(
    session: SessionDep,
    puzzle_id: UUID,
    body: GuessIn,
    current_user: UserOut = Depends(get_current_user),
    _: None = Depends(user_rate_limit(30, 60)),
) -> GuessOut:
    """Submit one guess for a puzzle. The backend NFC-normalises the word,
    validates length and dictionary membership, scores the colour vector,
    persists the guess, and returns the result.

    On error returns HTTP 400 (or 410 after the event ends) with a typed
    body of shape ``{"detail": {"error_code": "...", "detail": "..."}}``.
    See :class:`app.schemas.heidursordla.GuessErrorCode` for the full set
    of error codes the frontend distinguishes.
    """
    svc = HeidursordlaService(session)
    return await svc.submit_guess(
        puzzle_id=puzzle_id,
        user_id=current_user.id,
        raw_word=body.word,
    )
