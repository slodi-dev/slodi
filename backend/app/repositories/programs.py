from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.event import Event
from app.models.program import Program
from app.models.tag import ContentTag
from app.repositories.base import Repository
from app.repositories.content import (
    ContentStats,
    comment_count_subq,
    like_count_subq,
    liked_by_me_subq,
)


class ProgramRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(
        self, program_id: UUID, current_user_id: UUID | None = None
    ) -> tuple[Program, ContentStats] | None:
        stmt = (
            select(
                Program, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Program.author),
                selectinload(Program.workspace),
                selectinload(Program.events).options(
                    selectinload(Event.author),
                    selectinload(Event.workspace),
                    selectinload(Event.content_tags).selectinload(ContentTag.tag),
                ),
                selectinload(Program.comments),
                selectinload(Program.content_tags).selectinload(ContentTag.tag),
            )
            .where(Program.id == program_id, Program.deleted_at.is_(None))
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        prog, lc, cc, lm = row
        return prog, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def get_in_workspace(
        self, program_id: UUID, workspace_id: UUID, current_user_id: UUID | None = None
    ) -> tuple[Program, ContentStats] | None:
        stmt = (
            select(
                Program, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Program.author),
                selectinload(Program.workspace),
                selectinload(Program.events).options(
                    selectinload(Event.author),
                    selectinload(Event.workspace),
                    selectinload(Event.content_tags).selectinload(ContentTag.tag),
                ),
                selectinload(Program.comments),
                selectinload(Program.content_tags).selectinload(ContentTag.tag),
            )
            .where(
                Program.id == program_id,
                Program.workspace_id == workspace_id,
                Program.deleted_at.is_(None),
            )
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        prog, lc, cc, lm = row
        return prog, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    async def count_programs_for_workspace(self, workspace_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(Program)
            .where(Program.workspace_id == workspace_id, Program.deleted_at.is_(None))
        )
        return result or 0

    async def list_by_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[Program, ContentStats]]:
        stmt = (
            select(
                Program, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Program.author),
                selectinload(Program.workspace),
                selectinload(Program.content_tags).selectinload(ContentTag.tag),
            )
            .where(Program.workspace_id == workspace_id, Program.deleted_at.is_(None))
            .order_by(Program.name)
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            (prog, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm)))
            for prog, lc, cc, lm in rows
        ]

    async def create(self, program: Program) -> Program:
        await self.add(program)
        return program

    async def delete(self, program_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)

        # Orphan events: clear program_id so events remain as standalone workspace events
        await self.session.execute(
            update(Event).where(Event.program_id == program_id).values(program_id=None)
        )

        # Soft-delete the program itself
        res = await self.session.execute(
            update(Content)
            .where(Content.id == program_id, Content.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
