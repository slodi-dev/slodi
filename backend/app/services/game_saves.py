from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.game_saves import GameSaveRepository
from app.schemas.game_save import GameSaveOut


class GameSaveService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = GameSaveRepository(session)

    async def get_save(self, user_id: UUID, game_slug: str) -> GameSaveOut | None:
        row = await self.repo.get(user_id, game_slug)
        return GameSaveOut.model_validate(row) if row else None

    async def put_save(
        self,
        user_id: UUID,
        game_slug: str,
        state: dict[str, Any],
        revision: int,
    ) -> tuple[GameSaveOut, bool]:
        """Store a save and return it with whether this write was the one kept.

        A rejected write is not an error: it means another tab or device has
        already stored something newer. The caller is told so it can reconcile,
        and the stored save is returned either way so the client can adopt it.
        """
        stored = await self.repo.upsert(
            user_id=user_id, game_slug=game_slug, state=state, revision=revision
        )
        await self.session.commit()
        current = await self.repo.get(user_id, game_slug)
        # The row is guaranteed to exist here: either this write created it or
        # a newer one was already present.
        assert current is not None
        return GameSaveOut.model_validate(current), stored
