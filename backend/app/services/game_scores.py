from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.game_scores import GameScoreRepository
from app.schemas.game_score import GameScoreOut


class GameScoreService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = GameScoreRepository(session)

    async def submit_score(
        self,
        user_id: UUID,
        user_name: str,
        game_slug: str,
        score: int,
    ) -> list[GameScoreOut]:
        await self.repo.upsert(
            user_id=user_id, user_name=user_name, game_slug=game_slug, score=score
        )
        await self.session.commit()
        return await self.get_top_scores(game_slug)

    async def get_top_scores(self, game_slug: str) -> list[GameScoreOut]:
        rows = await self.repo.get_top_scores(game_slug)
        return [GameScoreOut.model_validate(r) for r in rows]
