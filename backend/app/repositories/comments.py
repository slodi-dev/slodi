from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.comment import Comment
from app.repositories.base import Repository


class CommentRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, comment_id: UUID) -> Comment | None:
        stmt = (
            select(Comment)
            .options(
                selectinload(Comment.user),
                selectinload(Comment.content),
            )
            .where(Comment.id == comment_id, Comment.deleted_at.is_(None))
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def count_content_comments(self, content_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(Comment)
            .where(Comment.content_id == content_id, Comment.deleted_at.is_(None))
        )
        return result or 0

    async def list_for_content(
        self,
        content_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Comment]:
        stmt = (
            select(Comment)
            .where(Comment.content_id == content_id, Comment.deleted_at.is_(None))
            .order_by(desc(Comment.created_at), Comment.id)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def create(self, comment: Comment) -> Comment:
        await self.add(comment)
        return comment

    async def delete(self, comment_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)
        res = await self.session.execute(
            update(Comment)
            .where(Comment.id == comment_id, Comment.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        return res.rowcount or 0
