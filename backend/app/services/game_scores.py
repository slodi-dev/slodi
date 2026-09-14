from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.game_score_policy import score_replaces
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
            user_id=user_id,
            user_name=user_name,
            game_slug=game_slug,
            score=score,
            replace=score_replaces(game_slug),
        )
        await self.session.commit()
        return await self.get_top_scores(game_slug)

    async def delete_score(self, game_slug: str, user_id: str) -> bool:
        """Delete one player's score. False when there was nothing to delete."""
        try:
            uuid = UUID(user_id)
        except ValueError:
            return False
        removed = await self.repo.delete_for_user(game_slug=game_slug, user_id=uuid)
        await self.session.commit()
        return removed > 0

    async def get_top_scores(self, game_slug: str) -> list[GameScoreOut]:
        rows = await self.repo.get_top_scores(game_slug)
        return [GameScoreOut.model_validate(r) for r in rows]
