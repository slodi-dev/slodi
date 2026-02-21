from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
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
        self, task_id: UUID, current_user_id: UUID | None = None
    ) -> tuple[Task, ContentStats] | None:
        stmt = (
            select(Task, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id))
            .options(
                selectinload(Task.author),
                selectinload(Task.event),
                selectinload(Task.content_tags),
            )
            .where(Task.id == task_id, Task.deleted_at.is_(None))
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        task, lc, cc, lm = row
        return task, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def get_in_event(
        self, task_id: UUID, event_id: UUID, current_user_id: UUID | None = None
    ) -> tuple[Task, ContentStats] | None:
        stmt = (
            select(Task, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id))
            .options(
                selectinload(Task.author),
                selectinload(Task.content_tags),
            )
            .where(Task.id == task_id, Task.event_id == event_id, Task.deleted_at.is_(None))
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        task, lc, cc, lm = row
        return task, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def count_tasks_for_event(self, event_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(Task)
            .where(Task.event_id == event_id, Task.deleted_at.is_(None))
        )
        return result or 0

    async def list_for_event(
        self,
        event_id: UUID,
        current_user_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[Task, ContentStats]]:
        stmt = (
            select(Task, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id))
            .where(Task.event_id == event_id, Task.deleted_at.is_(None))
            .order_by(Task.name)
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            (task, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm)))
            for task, lc, cc, lm in rows
        ]

    async def create(self, task: Task) -> Task:
        await self.add(task)
        return task

    async def delete(self, task_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)
        res = await self.session.execute(
            update(Content)
            .where(Content.id == task_id, Content.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        return res.rowcount or 0
