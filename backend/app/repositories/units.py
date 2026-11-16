from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.unit import Unit
from app.repositories.base import Repository


class UnitRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, unit_id: UUID) -> Unit | None:
        return await self.session.get(Unit, unit_id)

    async def list_for_workspace(self, workspace_id: UUID) -> Sequence[Unit]:
        stmt = (
            select(Unit)
            .where(Unit.workspace_id == workspace_id)
            .order_by(Unit.created_at, Unit.name)
        )
        return await self.scalars(stmt)

    async def colors_in_use(self, workspace_id: UUID) -> set[str]:
        rows = await self.scalars(select(Unit.color).where(Unit.workspace_id == workspace_id))
        return set(rows)

    async def ancestor_ids(self, unit_id: UUID) -> set[UUID]:
        """The unit and every unit above it."""
        chain = select(Unit.id, Unit.parent_id).where(Unit.id == unit_id).cte(recursive=True)
        chain = chain.union_all(
            select(Unit.id, Unit.parent_id).join(chain, Unit.id == chain.c.parent_id)
        )
        return set(await self.scalars(select(chain.c.id)))

    async def delete(self, unit: Unit) -> None:
        await self.session.delete(unit)
