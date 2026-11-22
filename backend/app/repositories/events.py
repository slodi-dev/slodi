from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.comment import Comment
from app.models.content import Content
from app.models.event import Event
from app.models.tag import ContentTag
from app.models.task import Task
from app.repositories.base import Repository
from app.repositories.content import (
    ContentStats,
    comment_count_subq,
    like_count_subq,
    liked_by_me_subq,
    listable,
)


class EventRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(
        self,
        event_id: UUID,
        current_user_id: UUID | None = None,
        *,
        include_hidden: bool = False,
        include_hidden_children: bool = False,
    ) -> tuple[Event, ContentStats] | None:
        stmt = (
            select(
                Event, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Event.author),
                selectinload(Event.workspace),
                selectinload(
                    Event.tasks.and_(listable(Task, include_hidden=include_hidden_children))
                ).options(
                    selectinload(Task.author),
                    selectinload(Task.workspace),
                    selectinload(Task.content_tags).selectinload(ContentTag.tag),
                ),
                selectinload(Event.comments.and_(Comment.deleted_at.is_(None))).selectinload(
                    Comment.user
                ),
                selectinload(Event.content_tags).selectinload(ContentTag.tag),
            )
            .where(Event.id == event_id, Event.deleted_at.is_(None))
        )
        if not include_hidden:
            stmt = stmt.where(Event.hidden_at.is_(None))
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        event, lc, cc, lm = row
        return event, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def create(self, event: Event) -> Event:
        await self.add(event)
        return event

    async def delete(self, event_id: UUID) -> int:
        # Its tasks stay in the workspace without an event.
        await self.session.execute(
            update(Task).where(Task.event_id == event_id).values(event_id=None)
        )
        res = await self.session.execute(
            update(Content)
            .where(Content.id == event_id, Content.deleted_at.is_(None))
            .values(deleted_at=dt.datetime.now(dt.timezone.utc))
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
