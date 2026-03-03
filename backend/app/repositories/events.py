from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import and_, asc, func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
)


class EventRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(
        self, event_id: UUID, current_user_id: UUID | None = None
    ) -> tuple[Event, ContentStats] | None:
        stmt = (
            select(
                Event, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Event.author),
                selectinload(Event.workspace),
                selectinload(Event.tasks).options(
                    selectinload(Task.author),
                    selectinload(Task.workspace),
                    selectinload(Task.content_tags).selectinload(ContentTag.tag),
                ),
                selectinload(Event.comments),
                selectinload(Event.content_tags).selectinload(ContentTag.tag),
            )
            .where(Event.id == event_id, Event.deleted_at.is_(None))
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        event, lc, cc, lm = row
        return event, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def get_in_program(
        self,
        event_id: UUID,
        program_id: UUID,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
    ) -> tuple[Event, ContentStats] | None:
        stmt = (
            select(
                Event, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Event.author),
                selectinload(Event.workspace),
                selectinload(Event.tasks).options(
                    selectinload(Task.author),
                    selectinload(Task.workspace),
                    selectinload(Task.content_tags).selectinload(ContentTag.tag),
                ),
                selectinload(Event.comments),
                selectinload(Event.content_tags).selectinload(ContentTag.tag),
            )
            .where(
                Event.id == event_id,
                Event.program_id == program_id,
                Event.workspace_id == workspace_id,
                Event.deleted_at.is_(None),
            )
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        event, lc, cc, lm = row
        return event, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def count_for_workspace(
        self,
        workspace_id: UUID,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
    ) -> int:
        conds = [Event.workspace_id == workspace_id, Event.deleted_at.is_(None)]
        if date_from is not None:
            conds.append(Event.start_dt >= date_from)
        if date_to is not None:
            conds.append(Event.start_dt <= date_to)

        result = await self.session.scalar(
            select(func.count()).select_from(Event).where(and_(*conds))
        )
        return result or 0

    async def list_for_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[Event, ContentStats]]:
        conds = [Event.workspace_id == workspace_id, Event.deleted_at.is_(None)]
        if date_from is not None:
            conds.append(Event.start_dt >= date_from)
        if date_to is not None:
            conds.append(Event.start_dt <= date_to)

        stmt = (
            select(
                Event, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Event.author),
                selectinload(Event.workspace),
                selectinload(Event.content_tags).selectinload(ContentTag.tag),
            )
            .where(and_(*conds))
            .order_by(asc(Event.start_dt))
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            (event, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm)))
            for event, lc, cc, lm in rows
        ]

    async def count_for_program(
        self,
        workspace_id: UUID,
        program_id: UUID,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
    ) -> int:
        conds = [
            Event.workspace_id == workspace_id,
            Event.program_id == program_id,
            Event.deleted_at.is_(None),
        ]
        if date_from is not None:
            conds.append(Event.start_dt >= date_from)
        if date_to is not None:
            conds.append(Event.start_dt <= date_to)

        result = await self.session.scalar(
            select(func.count()).select_from(Event).where(and_(*conds))
        )
        return result or 0

    async def list_for_program(
        self,
        workspace_id: UUID,
        program_id: UUID,
        current_user_id: UUID | None = None,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[Event, ContentStats]]:
        conds = [
            Event.workspace_id == workspace_id,
            Event.program_id == program_id,
            Event.deleted_at.is_(None),
        ]
        if date_from is not None:
            conds.append(Event.start_dt >= date_from)
        if date_to is not None:
            conds.append(Event.start_dt <= date_to)

        stmt = (
            select(
                Event, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Event.author),
                selectinload(Event.workspace),
                selectinload(Event.content_tags).selectinload(ContentTag.tag),
            )
            .where(and_(*conds))
            .order_by(asc(Event.start_dt))
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            (event, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm)))
            for event, lc, cc, lm in rows
        ]

    async def create(self, event: Event) -> Event:
        await self.add(event)
        return event

    async def delete(self, event_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)

        # Orphan tasks: clear event_id so tasks remain as workspace tasks
        await self.session.execute(
            update(Task).where(Task.event_id == event_id).values(event_id=None)
        )

        # Soft-delete the event itself
        res = await self.session.execute(
            update(Content)
            .where(Content.id == event_id, Content.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
