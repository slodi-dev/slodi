# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_session
from app.core.rate_limiter import user_rate_limit
from app.schemas.game_score import GameScoreCreate, GameScoreOut
from app.schemas.user import UserOut
from app.services.game_scores import GameScoreService

router = APIRouter(tags=["game-scores"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/games/{game_slug}/scores", response_model=list[GameScoreOut])
async def get_scores(session: SessionDep, game_slug: str) -> list[GameScoreOut]:
    svc = GameScoreService(session)
    return await svc.get_top_scores(game_slug)


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
    _: None = Depends(user_rate_limit(10, 60)),
) -> list[GameScoreOut]:
    svc = GameScoreService(session)
    return await svc.submit_score(
        user_id=current_user.id,
        user_name=current_user.name,
        game_slug=game_slug,
        score=body.score,
    )
