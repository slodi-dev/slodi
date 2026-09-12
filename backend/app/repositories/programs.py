from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, func, or_, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.comment import Comment
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
from app.schemas.program import ProgramFilters


class ProgramRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(
        self,
        program_id: UUID,
        current_user_id: UUID | None = None,
        *,
        include_hidden: bool = False,
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
                selectinload(Program.comments).selectinload(Comment.user),
                selectinload(Program.content_tags).selectinload(ContentTag.tag),
            )
            .where(Program.id == program_id, Program.deleted_at.is_(None))
        )
        if not include_hidden:
            # Otherwise hiding something only removes it from the list, and
            # anyone holding the link still reads it.
            stmt = stmt.where(Program.hidden_at.is_(None))
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
                selectinload(Program.comments).selectinload(Comment.user),
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

    def _apply_filters(self, stmt: Select, filters: ProgramFilters) -> Select:  # noqa: C901
        """Apply filter conditions to a SELECT statement."""
        if filters.search:
            escaped = filters.search.replace("%", r"\%").replace("_", r"\_")
            pattern = f"%{escaped}%"
            stmt = stmt.where(
                or_(
                    Content.name.ilike(pattern),
                    Content.description.ilike(pattern),
                )
            )
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
            escaped_location = filters.location.replace("%", r"\%").replace("_", r"\_")
            stmt = stmt.where(Content.location.ilike(f"%{escaped_location}%"))
        if filters.equipment:
            # JSONB array: check if equipment contains any of the given items (OR logic)
            stmt = stmt.where(
                or_(*(Content.equipment.contains([item]) for item in filters.equipment))
            )
        if filters.author_id is not None:
            stmt = stmt.where(Content.author_id == filters.author_id)
        return stmt

    def _apply_sort(
        self,
        stmt: Select,
        filters: ProgramFilters,
        like_count_col: ColumnElement[Any] | None = None,
    ) -> Select:
        """Apply sorting to a SELECT statement."""
        if filters.sort_by == "oldest":
            stmt = stmt.order_by(Content.created_at.asc())
        elif filters.sort_by == "newest":
            stmt = stmt.order_by(Content.created_at.desc())
        elif filters.sort_by == "liked" and like_count_col is not None:
            stmt = stmt.order_by(like_count_col.desc(), Content.created_at.desc())
        elif filters.sort_by == "alpha":
            stmt = stmt.order_by(Content.name.asc())
        else:
            stmt = stmt.order_by(Content.name)
        return stmt

    async def count_programs_for_workspace(
        self, workspace_id: UUID, filters: ProgramFilters | None = None
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(Program)
            .where(
                Content.workspace_id == workspace_id,
                Content.deleted_at.is_(None),
                # Hidden means the same as deleted to a listing: not listed, not
                # gone. A moderator reaches it through the Yfirferð board.
                Content.hidden_at.is_(None),
            )
        )
        stmt = self._apply_filters(stmt, filters or ProgramFilters())
        result = await self.session.scalar(stmt)
        return result or 0

    async def get_content_type(self, content_id: UUID) -> str | None:
        """The discriminator for one row, without loading the row itself.

        `GET /content/{id}` has to know which subtype it is holding before it
        can pick a loader, and every subtype loader eager-loads relationships
        that only exist on that subtype. Selecting the discriminator alone
        keeps that decision to a single cheap scalar.
        """
        stmt = select(Content.content_type).where(
            Content.id == content_id, Content.deleted_at.is_(None)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def count_content_for_workspace(
        self, workspace_id: UUID, filters: ProgramFilters | None = None
    ) -> int:
        """Counts every kind, to match `list_content_by_workspace`."""
        stmt = (
            select(func.count())
            .select_from(Content)
            .where(
                Content.workspace_id == workspace_id,
                Content.deleted_at.is_(None),
                Content.hidden_at.is_(None),
            )
        )
        stmt = self._apply_filters(stmt, filters or ProgramFilters())
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
        resolved_filters = filters or ProgramFilters()
        lc_subq = like_count_subq()
        stmt = (
            select(Program, lc_subq, comment_count_subq(), liked_by_me_subq(current_user_id))
            .options(
                selectinload(Program.author),
                selectinload(Program.workspace),
                selectinload(Program.content_tags).selectinload(ContentTag.tag),
            )
            .where(
                Program.workspace_id == workspace_id,
                Program.deleted_at.is_(None),
                # Hidden means the same as deleted to a listing: not listed, not
                # gone. A moderator reaches it through the Yfirferð board.
                Program.hidden_at.is_(None),
            )
        )
        stmt = self._apply_filters(stmt, resolved_filters)
        stmt = self._apply_sort(stmt, resolved_filters, like_count_col=lc_subq)
        stmt = stmt.limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).all()
        return [
            (prog, ContentStats(like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm)))
            for prog, lc, cc, lm in rows
        ]

    async def list_content_by_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
        filters: ProgramFilters | None = None,
    ) -> list[tuple[Content, ContentStats]]:
        """Everything in the bank, whatever kind it is.

        The bank list used to read `/programs`, which returns only rows whose
        `content_type` is `program`. That was invisible while *everything* was
        filed as a program — and the moment the create chooser started filing a
        Verkefni as a task, every correctly-typed submission vanished from the
        bank it had just been added to.

        Selects the polymorphic base rather than a subtype, so one query covers
        all three. The filters are shared with `list_by_workspace` and name
        `Content.*` columns for exactly this reason: naming `Program.*` while
        selecting `Content` makes SQLAlchemy alias the base table and match
        nothing, with an SAWarning as the only sign.
        """
        resolved_filters = filters or ProgramFilters()
        lc_subq = like_count_subq()
        stmt = (
            select(Content, lc_subq, comment_count_subq(), liked_by_me_subq(current_user_id))
            .options(
                selectinload(Content.author),
                selectinload(Content.workspace),
                selectinload(Content.content_tags).selectinload(ContentTag.tag),
            )
            .where(
                Content.workspace_id == workspace_id,
                Content.deleted_at.is_(None),
                # Hidden means "not listed, not gone" — a moderator took it out
                # of the bank, so the bank must not show it.
                Content.hidden_at.is_(None),
            )
        )
        stmt = self._apply_filters(stmt, resolved_filters)
        stmt = self._apply_sort(stmt, resolved_filters, like_count_col=lc_subq)
        stmt = stmt.limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).all()
        return [
            (row[0], ContentStats(like_count=row[1], comment_count=row[2], liked_by_me=row[3]))
            for row in rows
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
