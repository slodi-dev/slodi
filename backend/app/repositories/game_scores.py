from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.models.game_score import GameScore
from app.repositories.base import Repository


class GameScoreRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def upsert(
        self,
        user_id: UUID,
        user_name: str,
        game_slug: str,
        score: int,
        replace: bool = False,
    ) -> None:
        """Store a score for this user and game.

        By default the row only ever moves up: a submission below the stored
        score is discarded, which is what an arcade high score wants. When
        `replace` is set the new value is written unconditionally, for games
        whose score tracks something the player can spend back down.
        """
        insert = pg_insert(GameScore).values(
            user_id=user_id,
            user_name=user_name,
            game_slug=game_slug,
            score=score,
        )
        updates = {
            "score": text("EXCLUDED.score"),
            "achieved_at": func.now(),
            "user_name": text("EXCLUDED.user_name"),
        }
        if replace:
            stmt = insert.on_conflict_do_update(
                constraint="uq_game_score_user_game",
                set_=updates,
            )
        else:
            stmt = insert.on_conflict_do_update(
                constraint="uq_game_score_user_game",
                set_=updates,
                where=GameScore.__table__.c.score < text("EXCLUDED.score"),
            )
        await self.session.execute(stmt)

    async def delete_for_user(self, game_slug: str, user_id: UUID) -> int:
        """Remove one player's score for a game. Returns how many rows went."""
        stmt = delete(GameScore).where(
            GameScore.game_slug == game_slug, GameScore.user_id == user_id
        )
        result = await self.session.execute(stmt)
        # CursorResult carries rowcount; the generic Result protocol does not.
        # A DBAPI may report -1 for "unknown"; treat that as "assume it went",
        # since reporting 0 would 404 a delete that actually removed the row.
        rowcount = int(getattr(result, "rowcount", 0) or 0)
        return 1 if rowcount < 0 else rowcount

    async def get_top_scores(self, game_slug: str, limit: int = 10) -> Sequence[GameScore]:
        stmt = (
            select(GameScore)
            .where(GameScore.game_slug == game_slug)
            .order_by(GameScore.score.desc())
            .limit(limit)
        )
        return await self.scalars(stmt)
