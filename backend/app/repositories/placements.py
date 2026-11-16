from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import CTE, Select, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.placement import Placement
from app.models.tag import ContentTag
from app.models.unit import Unit, UnitParticipation
from app.repositories.base import Repository


class PlacementRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, placement_id: UUID) -> Placement | None:
        return await self.session.get(Placement, placement_id)

    async def get_content(self, content_id: UUID) -> Content | None:
        return await self.session.scalar(
            select(Content)
            .options(selectinload(Content.content_tags))
            .where(Content.id == content_id, Content.deleted_at.is_(None))
        )

    async def top_of(self, content_id: UUID) -> Placement | None:
        """The content's own structure: its first placement with no parent."""
        return await self.session.scalar(
            select(Placement)
            .where(Placement.content_id == content_id, Placement.parent_id.is_(None))
            .order_by(Placement.created_at, Placement.id)
            .limit(1)
        )

    async def copies_in_workspace(
        self, source_ids: Sequence[UUID], workspace_id: UUID
    ) -> Sequence[Content]:
        """The workspace's copies of the sources, newest first."""
        return await self.scalars(
            select(Content)
            .where(
                Content.copied_from_id.in_(source_ids),
                Content.workspace_id == workspace_id,
                Content.deleted_at.is_(None),
            )
            .order_by(Content.created_at.desc())
        )

    async def list_for_workspace(
        self,
        workspace_id: UUID,
        *,
        top: bool | None = None,
        level: Sequence[int] | None = None,
        start: dt.datetime | None = None,
        end: dt.datetime | None = None,
    ) -> Sequence[Placement]:
        stmt = self._with_content(select(Placement)).where(Placement.workspace_id == workspace_id)
        if top is True:
            stmt = stmt.where(Placement.parent_id.is_(None))
        elif top is False:
            stmt = stmt.where(Placement.parent_id.is_not(None))
        if level:
            stmt = stmt.where(Placement.content_level.in_(level))
        if start is not None:
            stmt = stmt.where(Placement.ends_at >= start)
        if end is not None:
            stmt = stmt.where(Placement.starts_at <= end)
        return await self.scalars(stmt.order_by(Placement.starts_at, Placement.id))

    async def subtree(self, root_id: UUID) -> Sequence[Placement]:
        """The placement and everything under it, in start order."""
        ids = self._subtree_ids(root_id)
        stmt = self._with_content(select(Placement)).where(Placement.id.in_(select(ids.c.id)))
        return await self.scalars(stmt.order_by(Placement.starts_at, Placement.id))

    async def get_many(self, ids: Sequence[UUID]) -> Sequence[Placement]:
        stmt = self._with_content(select(Placement)).where(Placement.id.in_(ids))
        return await self.scalars(stmt.order_by(Placement.starts_at, Placement.id))

    async def shift_below(self, root_id: UUID, delta: dt.timedelta) -> None:
        ids = self._subtree_ids(root_id)
        await self.session.execute(
            update(Placement)
            .where(Placement.id.in_(select(ids.c.id)), Placement.id != root_id)
            .values(starts_at=Placement.starts_at + delta, ends_at=Placement.ends_at + delta)
            .execution_options(synchronize_session=False)
        )

    async def unit_ids(self, placement_ids: Sequence[UUID]) -> dict[UUID, list[UUID]]:
        rows = await self.session.execute(
            select(UnitParticipation.placement_id, UnitParticipation.unit_id).where(
                UnitParticipation.placement_id.in_(placement_ids)
            )
        )
        found: dict[UUID, list[UUID]] = {}
        for placement_id, unit_id in rows:
            found.setdefault(placement_id, []).append(unit_id)
        return found

    async def units_in_workspace(self, workspace_id: UUID, unit_ids: Sequence[UUID]) -> set[UUID]:
        rows = await self.scalars(
            select(Unit.id).where(
                Unit.workspace_id == workspace_id,
                Unit.id.in_(unit_ids),
                Unit.deleted_at.is_(None),
            )
        )
        return set(rows)

    async def set_units(self, placement_id: UUID, unit_ids: Sequence[UUID]) -> None:
        await self.session.execute(
            delete(UnitParticipation).where(UnitParticipation.placement_id == placement_id)
        )
        self.session.add_all(
            UnitParticipation(placement_id=placement_id, unit_id=unit_id)
            for unit_id in dict.fromkeys(unit_ids)
        )

    async def times_used(self, content_ids: Sequence[UUID]) -> dict[UUID, int]:
        """Placements of each item plus copies made from it."""
        counts: dict[UUID, int] = dict.fromkeys(content_ids, 0)
        placed = await self.session.execute(
            select(Placement.content_id, func.count())
            .where(Placement.content_id.in_(content_ids))
            .group_by(Placement.content_id)
        )
        copied = await self.session.execute(
            select(Content.copied_from_id, func.count())
            .where(Content.copied_from_id.in_(content_ids), Content.deleted_at.is_(None))
            .group_by(Content.copied_from_id)
        )
        for content_id, n in [*placed, *copied]:
            counts[content_id] += n
        return counts

    async def delete(self, placement: Placement) -> None:
        await self.session.delete(placement)

    @staticmethod
    def _subtree_ids(root_id: UUID) -> CTE:
        tree = select(Placement.id).where(Placement.id == root_id).cte(recursive=True)
        return tree.union_all(select(Placement.id).where(Placement.parent_id == tree.c.id))

    @staticmethod
    def _with_content(stmt: Select[Any]) -> Select[Any]:
        return stmt.options(
            selectinload(Placement.content)
            .selectinload(Content.content_tags)
            .selectinload(ContentTag.tag)
        ).execution_options(populate_existing=True)

    async def subtree_rows(self, root_id: UUID) -> Sequence[Placement]:
        """The subtree, parents before children."""
        rows = await self.subtree(root_id)
        depth: dict[UUID, int] = {root_id: 0}
        by_id = {p.id: p for p in rows}

        def depth_of(p: Placement) -> int:
            if p.id not in depth:
                parent = by_id[p.parent_id] if p.parent_id is not None else None
                depth[p.id] = 0 if parent is None else depth_of(parent) + 1
            return depth[p.id]

        return sorted(rows, key=depth_of)
