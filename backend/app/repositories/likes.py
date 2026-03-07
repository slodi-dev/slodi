from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.like import UserLikedContent
from app.repositories.base import Repository


class LikeRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def count_content_likes(self, content_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(UserLikedContent)
            .where(UserLikedContent.content_id == content_id)
        )
        return result or 0

    async def list_for_content(
        self,
        content_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[UserLikedContent]:
        stmt = (
            select(UserLikedContent)
            .where(UserLikedContent.content_id == content_id)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def create(self, like: UserLikedContent) -> UserLikedContent:
        await self.add(like)
        return like

    async def delete(self, user_id: UUID, content_id: UUID) -> int:
        res = await self.session.execute(
            delete(UserLikedContent).where(
                UserLikedContent.user_id == user_id, UserLikedContent.content_id == content_id
            )
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
