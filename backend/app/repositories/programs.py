from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, or_, select, update
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


@dataclass
class ProgramFilters:
    """Filter parameters for listing programs."""

    search: str | None = None
    age: list[str] | None = None
    duration_min: int | None = None
    duration_max: int | None = None
    prep_time_min: int | None = None
    prep_time_max: int | None = None
    count_min: int | None = None
    count_max: int | None = None
    price_max: int | None = None
    location: str | None = None
    equipment: list[str] | None = None
    author_id: UUID | None = None
    sort_by: str | None = None


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

    def _apply_filters(self, stmt, filters: ProgramFilters):  # noqa: C901
        """Apply filter conditions to a SELECT statement."""
        if filters.search:
            pattern = f"%{filters.search}%"
            stmt = stmt.where(
                or_(
                    Program.name.ilike(pattern),
                    Program.description.ilike(pattern),
                )
            )
        if filters.age:
            # PostgreSQL ARRAY overlap operator: content.age && ARRAY[...]
            stmt = stmt.where(Program.age.overlap(filters.age))
        if filters.duration_min is not None:
            stmt = stmt.where(Program.duration_min >= filters.duration_min)
        if filters.duration_max is not None:
            stmt = stmt.where(Program.duration_max <= filters.duration_max)
        if filters.prep_time_min is not None:
            stmt = stmt.where(Program.prep_time_min >= filters.prep_time_min)
        if filters.prep_time_max is not None:
            stmt = stmt.where(Program.prep_time_max <= filters.prep_time_max)
        if filters.count_min is not None:
            stmt = stmt.where(Program.count_min >= filters.count_min)
        if filters.count_max is not None:
            stmt = stmt.where(Program.count_max <= filters.count_max)
        if filters.price_max is not None:
            if filters.price_max == 0:
                stmt = stmt.where(or_(Program.price == 0, Program.price.is_(None)))
            else:
                stmt = stmt.where(Program.price <= filters.price_max)
        if filters.location:
            stmt = stmt.where(Program.location.ilike(f"%{filters.location}%"))
        if filters.equipment:
            # JSONB array: check if equipment contains any of the given items (OR logic)
            stmt = stmt.where(
                or_(*(Program.equipment.contains([item]) for item in filters.equipment))
            )
        if filters.author_id is not None:
            stmt = stmt.where(Program.author_id == filters.author_id)
        return stmt

    def _apply_sort(self, stmt, filters: ProgramFilters, like_count_col=None):
        """Apply sorting to a SELECT statement."""
        sort_by = filters.sort_by
        if sort_by == "oldest":
            stmt = stmt.order_by(Program.created_at.asc())
        elif sort_by == "liked" and like_count_col is not None:
            stmt = stmt.order_by(like_count_col.desc(), Program.created_at.desc())
        elif sort_by == "alpha":
            stmt = stmt.order_by(Program.name.asc())
        else:
            # Default: newest first (preserves backwards compat with current name ordering
            # only when sort_by is explicitly None — callers that want the old order
            # should pass sort_by=None)
            if sort_by == "newest":
                stmt = stmt.order_by(Program.created_at.desc())
            else:
                # No sort_by param at all — keep existing default (order by name)
                stmt = stmt.order_by(Program.name)
        return stmt

    async def count_programs_for_workspace(
        self, workspace_id: UUID, filters: ProgramFilters | None = None
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(Program)
            .where(Program.workspace_id == workspace_id, Program.deleted_at.is_(None))
        )
        if filters:
            stmt = self._apply_filters(stmt, filters)
        result = await self.session.scalar(stmt)
        return result or 0

    async def list_by_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
        filters: ProgramFilters | None = None,
    ) -> list[tuple[Program, ContentStats]]:
        lc_subq = like_count_subq()
        stmt = (
            select(
                Program, lc_subq, comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Program.author),
                selectinload(Program.workspace),
                selectinload(Program.content_tags).selectinload(ContentTag.tag),
            )
            .where(Program.workspace_id == workspace_id, Program.deleted_at.is_(None))
        )
        if filters:
            stmt = self._apply_filters(stmt, filters)
            stmt = self._apply_sort(stmt, filters, like_count_col=lc_subq)
        else:
            stmt = stmt.order_by(Program.name)
        stmt = stmt.limit(limit).offset(offset)
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
