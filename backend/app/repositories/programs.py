from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, func, or_, select, true, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.comment import Comment
from app.models.content import Content
from app.models.event import Event
from app.models.program import Program
from app.models.tag import ContentTag, Tag
from app.models.user import User
from app.repositories.base import Repository
from app.repositories.content import (
    ContentStats,
    comment_count_subq,
    like_count_subq,
    liked_by_me_subq,
    listable,
)
from app.schemas.program import ProgramFilters


def _contains(text: str) -> str:
    """An ILIKE pattern matching `text` anywhere, with `%` and `_` taken literally."""
    return "%" + text.replace("%", r"\%").replace("_", r"\_") + "%"


class ProgramRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(
        self,
        program_id: UUID,
        current_user_id: UUID | None = None,
        *,
        include_hidden: bool = False,
        include_hidden_children: bool = False,
    ) -> tuple[Program, ContentStats] | None:
        stmt = (
            select(
                Program, like_count_subq(), comment_count_subq(), liked_by_me_subq(current_user_id)
            )
            .options(
                selectinload(Program.author),
                selectinload(Program.workspace),
                selectinload(
                    Program.events.and_(listable(Event, include_hidden=include_hidden_children))
                ).options(
                    selectinload(Event.author),
                    selectinload(Event.workspace),
                    selectinload(Event.content_tags).selectinload(ContentTag.tag),
                ),
                selectinload(Program.comments.and_(Comment.deleted_at.is_(None))).selectinload(
                    Comment.user
                ),
                selectinload(Program.content_tags).selectinload(ContentTag.tag),
            )
            .where(Program.id == program_id, Program.deleted_at.is_(None))
        )
        if not include_hidden:
            stmt = stmt.where(Program.hidden_at.is_(None))
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        prog, lc, cc, lm = row
        return prog, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm))

    def _apply_filters(self, stmt: Select, filters: ProgramFilters) -> Select:  # noqa: C901
        if filters.search:
            pattern = _contains(filters.search)
            stmt = stmt.where(or_(Content.name.ilike(pattern), Content.description.ilike(pattern)))
        if filters.age:
            # PostgreSQL ARRAY overlap operator: content.age && ARRAY[...]
            stmt = stmt.where(Content.age.overlap(filters.age))
        if filters.duration_min is not None:
            stmt = stmt.where(Content.duration_max >= filters.duration_min)
        if filters.duration_max is not None:
            stmt = stmt.where(Content.duration_min <= filters.duration_max)
        if filters.prep_time_min is not None:
            stmt = stmt.where(Content.prep_time_max >= filters.prep_time_min)
        if filters.prep_time_max is not None:
            stmt = stmt.where(Content.prep_time_min <= filters.prep_time_max)
        if filters.count_min is not None:
            stmt = stmt.where(Content.count_max >= filters.count_min)
        if filters.count_max is not None:
            stmt = stmt.where(Content.count_min <= filters.count_max)
        if filters.price_max is not None:
            if filters.price_max == 0:
                stmt = stmt.where(or_(Content.price == 0, Content.price.is_(None)))
            else:
                stmt = stmt.where(Content.price <= filters.price_max)
        if filters.location:
            stmt = stmt.where(Content.location.ilike(_contains(filters.location)))
        if filters.equipment:
            # JSONB array: check if equipment contains any of the given items (OR logic)
            stmt = stmt.where(
                or_(*(Content.equipment.contains([item]) for item in filters.equipment))
            )
        if filters.tags:
            # A subquery, not a join, so a row matching two tags is counted once.
            wanted = [t.strip().lower() for t in filters.tags if t.strip()]
            if wanted:
                stmt = stmt.where(
                    Content.id.in_(
                        select(ContentTag.content_id)
                        .join(Tag, Tag.id == ContentTag.tag_id)
                        .where(func.lower(Tag.name).in_(wanted), Tag.deleted_at.is_(None))
                    )
                )
        if filters.author_id is not None:
            stmt = stmt.where(Content.author_id == filters.author_id)
        if filters.author:
            authors = select(User.id).where(User.name.ilike(_contains(filters.author)))
            stmt = stmt.where(Content.author_id.in_(authors))
        return stmt

    def _apply_sort(
        self, stmt: Select, filters: ProgramFilters, like_count_col: ColumnElement[Any]
    ) -> Select:
        if filters.sort_by == "oldest":
            return stmt.order_by(Content.created_at.asc())
        if filters.sort_by == "newest":
            return stmt.order_by(Content.created_at.desc())
        if filters.sort_by == "liked":
            return stmt.order_by(like_count_col.desc(), Content.created_at.desc())
        return stmt.order_by(Content.name)

    @staticmethod
    def _in_bank(workspace_id: UUID) -> list[ColumnElement[bool]]:
        return [
            Content.workspace_id == workspace_id,
            Content.deleted_at.is_(None),
            Content.hidden_at.is_(None),
        ]

    async def facets_for_workspace(self, workspace_id: UUID) -> dict[str, list[str]]:
        """The distinct values the filter sidebar offers, across the whole bank."""
        base = self._in_bank(workspace_id)

        locations = await self.session.scalars(
            select(Content.location)
            .where(*base, Content.location.is_not(None), Content.location != "")
            .distinct()
            .order_by(Content.location)
        )

        # Check the type, not IS NOT NULL: JSON `null` is not SQL NULL and cannot be unnested.
        item = func.jsonb_array_elements_text(Content.equipment).table_valued("value")
        equipment = await self.session.scalars(
            select(item.c.value)
            .select_from(Content)
            .join(item, true())
            .where(*base, func.jsonb_typeof(Content.equipment) == "array")
            .distinct()
            .order_by(item.c.value)
        )

        authors = await self.session.scalars(
            select(User.name)
            .join(Content, Content.author_id == User.id)
            .where(*base)
            .distinct()
            .order_by(User.name)
        )

        tags = await self.session.scalars(
            select(Tag.name)
            .join(ContentTag, ContentTag.tag_id == Tag.id)
            .join(Content, Content.id == ContentTag.content_id)
            .where(*base, Tag.deleted_at.is_(None))
            .distinct()
            .order_by(Tag.name)
        )

        return {
            "locations": [v for v in locations if v],
            "equipment": [v for v in equipment if v],
            "authors": [v for v in authors if v],
            "tags": [v for v in tags if v],
        }

    async def get_content_type(self, content_id: UUID) -> str | None:
        stmt = select(Content.content_type).where(
            Content.id == content_id, Content.deleted_at.is_(None)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def count_content_for_workspace(
        self, workspace_id: UUID, filters: ProgramFilters | None = None
    ) -> int:
        stmt = select(func.count()).select_from(Content).where(*self._in_bank(workspace_id))
        stmt = self._apply_filters(stmt, filters or ProgramFilters())
        return await self.session.scalar(stmt) or 0

    async def list_content_by_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
        filters: ProgramFilters | None = None,
    ) -> list[tuple[Content, ContentStats]]:
        """Bank items of every kind. Filters name `Content.*` columns, not a subtype's."""
        resolved_filters = filters or ProgramFilters()
        lc_subq = like_count_subq()
        stmt = (
            select(Content, lc_subq, comment_count_subq(), liked_by_me_subq(current_user_id))
            .options(
                selectinload(Content.author),
                selectinload(Content.workspace),
                selectinload(Content.content_tags).selectinload(ContentTag.tag),
            )
            .where(*self._in_bank(workspace_id))
        )
        stmt = self._apply_filters(stmt, resolved_filters)
        stmt = self._apply_sort(stmt, resolved_filters, like_count_col=lc_subq)
        stmt = stmt.limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).all()
        return [
            (item, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm)))
            for item, lc, cc, lm in rows
        ]

    async def create(self, program: Program) -> Program:
        await self.add(program)
        return program

    async def delete(self, program_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)

        # Its events stay in the workspace without a program.
        await self.session.execute(
            update(Event).where(Event.program_id == program_id).values(program_id=None)
        )

        res = await self.session.execute(
            update(Content)
            .where(Content.id == program_id, Content.deleted_at.is_(None))
            .values(deleted_at=now)
        )
        assert isinstance(res, CursorResult)
        return res.rowcount or 0
