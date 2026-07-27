from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.models.game_save import GameSave
from app.repositories.base import Repository


class GameSaveRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, user_id: UUID, game_slug: str) -> GameSave | None:
        stmt = select(GameSave).where(
            GameSave.user_id == user_id,
            GameSave.game_slug == game_slug,
        )
        result = await self.session.execute(stmt)
        return result.scalars().one_or_none()

    async def upsert(
        self,
        user_id: UUID,
        game_slug: str,
        state: dict[str, Any],
        revision: int,
    ) -> bool:
        """Store a save, unless a newer one is already there.

        Returns whether the write landed. The revision guard is what makes two
        tabs and two devices safe: a save only overwrites one with a *lower*
        revision, so a stale tab flushing on close cannot undo newer progress.
        Equal revisions are rejected too — the same state written twice is not
        worth a row update, and it keeps the operation idempotent.
        """
        stmt = (
            pg_insert(GameSave)
            .values(
                user_id=user_id,
                game_slug=game_slug,
                state=state,
                revision=revision,
            )
            .on_conflict_do_update(
                constraint="uq_game_save_user_game",
                set_={
                    "state": text("EXCLUDED.state"),
                    "revision": text("EXCLUDED.revision"),
                    "updated_at": func.now(),
                },
                where=GameSave.__table__.c.revision < text("EXCLUDED.revision"),
            )
            .returning(GameSave.id)
        )
        result = await self.session.execute(stmt)
        # No row returned means the conflict target existed and the WHERE
        # rejected it — i.e. the stored save was already at least this new.
        return result.scalar_one_or_none() is not None
