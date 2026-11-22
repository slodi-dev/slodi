from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.comment import Comment
from app.models.content import Content
from app.models.tag import ContentTag
from app.models.task import Task
from app.repositories.base import Repository
from app.repositories.content import (
    ContentStats,
    comment_count_subq,
    like_count_subq,
    liked_by_me_subq,
)


class TaskRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(
        self,
        task_id: UUID,
        current_user_id: UUID | None = None,
        *,
        include_hidden: bool = False,
    ) -> tuple[Task, ContentStats] | None:
        stmt = (
            select(Task, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id))
            .options(
                selectinload(Task.author),
                selectinload(Task.workspace),
                selectinload(Task.comments.and_(Comment.deleted_at.is_(None))).selectinload(
                    Comment.user
                ),
                selectinload(Task.content_tags).selectinload(ContentTag.tag),
            )
            .where(Task.id == task_id, Task.deleted_at.is_(None))
        )
        if not include_hidden:
            stmt = stmt.where(Task.hidden_at.is_(None))
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        task, lc, cc, lm = row
        return task, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def create(self, task: Task) -> Task:
        await self.add(task)
        return task

    async def delete(self, task_id: UUID) -> int:
        res = await self.session.execute(
            update(Content)
            .where(Content.id == task_id, Content.deleted_at.is_(None))
            .values(deleted_at=dt.datetime.now(dt.timezone.utc))
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
