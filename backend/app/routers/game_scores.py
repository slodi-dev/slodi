# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.db import get_session
from app.core.rate_limiter import enforce_rate_limit
from app.core.run_token_store import is_spent, spend
from app.core.run_tokens import RunTokenError, issue, verify
from app.domain.game_score_policy import (
    PACE_GRACE_SECONDS,
    max_score,
    min_seconds_per_point,
    requires_run_token,
    submissions_per_minute,
)
from app.models.user import Permissions
from app.schemas.game_score import GameScoreCreate, GameScoreOut
from app.schemas.user import UserOut
from app.services.game_scores import GameScoreService

router = APIRouter(tags=["game-scores"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class RunTokenOut(BaseModel):
    run_token: str


@router.get("/games/{game_slug}/scores", response_model=list[GameScoreOut])
async def get_scores(session: SessionDep, game_slug: str) -> list[GameScoreOut]:
    svc = GameScoreService(session)
    return await svc.get_top_scores(game_slug)


@router.post("/games/{game_slug}/runs", response_model=RunTokenOut)
async def start_run(request: Request, game_slug: str) -> RunTokenOut:
    """
    Stamp the start of a run.

    The token carries a server timestamp, so the score submitted against it can
    be checked for having taken a humanly possible amount of time.

    Deliberately unauthenticated. A player who is signed out still has to be
    able to start a run, because their score is parked and submitted after they
    log in — requiring a session here would make every signed-out run permanently
    unsaveable. The token grants nothing on its own: the score submission still
    needs a valid session, and identity comes from that.

    Rate limited by client rather than by user for the same reason, and more
    generously than submissions, since restarting is cheap and frequent.
    """
    # The player's address, not the proxy's. Every request arrives from the
    # Next.js route handler, so request.client.host is the frontend server for
    # everyone — one shared bucket that a couple of dozen players would exhaust,
    # after which nobody could start a run at all.
    #
    # The *last* hop is taken, not the first: a client can put anything at the
    # head of X-Forwarded-For, so keying on it would let one caller rotate the
    # header to sidestep the limit entirely and fill the limiter's key space
    # with junk. The final entry is the one our own proxy appended. The length
    # cap is belt and braces against an oversized header inflating cache keys.
    forwarded = request.headers.get("x-forwarded-for", "")
    hops = [h.strip() for h in forwarded.split(",") if h.strip()]
    client = (hops[-1][:64] if hops else "") or (
        request.client.host if request.client else "unknown"
    )
    await enforce_rate_limit(f"{request.url.path}:{client}", 120, 60)
    return RunTokenOut(run_token=issue(game_slug))


async def _submission_rate_limit(
    request: Request,
    game_slug: str,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    """Per-user, per-game submission limit.

    The cap has to depend on the game: a flappy-style game finishes a run in
    seconds, so one shared number is either too tight for it or too loose for
    everything else.
    """
    key = f"{request.url.path}:user:{current_user.id}"
    await enforce_rate_limit(key, submissions_per_minute(game_slug), 60)


async def _check_plausible(game_slug: str, body: GameScoreCreate) -> str | None:
    """
    Reject scores that could not have been played, and return the run nonce.

    A client-computed score can never be trusted outright, so the two things
    checked here are the two that bound a forgery: the score has to be within
    what the game can produce at all, and it has to have taken at least as long
    as it would to actually play.
    """
    ceiling = max_score(game_slug)
    if body.score > ceiling:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Score exceeds the maximum for this game ({ceiling})",
        )

    if not requires_run_token(game_slug):
        return None

    if not body.run_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This game requires a run token; start a run first",
        )

    try:
        elapsed, nonce = verify(body.run_token, game_slug)
    except RunTokenError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if await is_spent(nonce):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This run has already been recorded",
        )

    # The token is stamped when the *server* receives POST /runs, which is one
    # round trip after the run really began, and the pace figure has under a
    # second of headroom at low scores. Without slack a cold route or a slow
    # mobile connection would reject an honest two-point run.
    required = body.score * min_seconds_per_point(game_slug) - PACE_GRACE_SECONDS
    if elapsed < required:
        # 425 rather than 422: this is "not yet", not "never". The same run
        # submitted against the same token later can pass, so the client keeps
        # it parked and retries instead of discarding the player's score.
        raise HTTPException(
            status_code=status.HTTP_425_TOO_EARLY,
            detail="Score is too high for how long the run has lasted so far",
        )

    return nonce


@router.post(
    "/games/{game_slug}/scores",
    response_model=list[GameScoreOut],
    status_code=status.HTTP_200_OK,
)
async def submit_score(
    session: SessionDep,
    game_slug: str,
    body: GameScoreCreate,
    current_user: UserOut = Depends(get_current_user),
    _: None = Depends(_submission_rate_limit),
) -> list[GameScoreOut]:
    nonce = await _check_plausible(game_slug, body)

    svc = GameScoreService(session)
    result = await svc.submit_score(
        user_id=current_user.id,
        user_name=current_user.name,
        game_slug=game_slug,
        score=body.score,
    )
    # Burned only now: a run rejected for being unauthenticated has to survive
    # the login round trip and be replayed with this same token.
    if nonce:
        await spend(nonce)
    return result


@router.delete(
    "/games/{game_slug}/scores/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_score(
    session: SessionDep,
    game_slug: str,
    user_id: str,
    _: UserOut = Depends(require_permission(Permissions.admin)),
) -> None:
    """Remove one player's score. The only way to clear an entry that got through."""
    svc = GameScoreService(session)
    removed = await svc.delete_score(game_slug=game_slug, user_id=user_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Score not found")
