# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_session
from app.core.rate_limiter import user_rate_limit
from app.domain.game_saves import is_saveable
from app.schemas.game_save import GameSaveIn, GameSaveOut
from app.schemas.user import UserOut
from app.services.game_saves import GameSaveService

router = APIRouter(tags=["game-saves"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _check_game(game_slug: str) -> None:
    """Reject unknown games.

    Scores are reached through the frontend proxy, which checks its own
    allowlist first. Saves are called directly on the API, so this is the only
    thing standing between an arbitrary slug and an arbitrary row.
    """
    if not is_saveable(game_slug):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown game")


@router.get("/games/{game_slug}/save", response_model=GameSaveOut)
async def get_save(
    session: SessionDep,
    game_slug: str,
    current_user: UserOut = Depends(get_current_user),
) -> GameSaveOut:
    _check_game(game_slug)
    svc = GameSaveService(session)
    save = await svc.get_save(current_user.id, game_slug)
    if save is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No save yet")
    return save


@router.put("/games/{game_slug}/save", response_model=GameSaveOut)
async def put_save(
    session: SessionDep,
    game_slug: str,
    body: GameSaveIn,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    # The client writes at most once every 30s, plus milestones and one flush on
    # page hide. This leaves generous headroom over that while stopping a loop.
    _: None = Depends(user_rate_limit(30, 60)),
) -> GameSaveOut:
    _check_game(game_slug)
    svc = GameSaveService(session)
    save, stored = await svc.put_save(
        user_id=current_user.id,
        game_slug=game_slug,
        state=body.state,
        revision=body.revision,
    )
    # A rejected write is not a failure — another tab or device simply had
    # something newer. 409 tells the client to adopt the returned save rather
    # than retry, which a 200 would not distinguish.
    if not stored:
        response.status_code = status.HTTP_409_CONFLICT
    return save
