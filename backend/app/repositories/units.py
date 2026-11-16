from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.unit import Unit
from app.repositories.base import Repository
from app.utils import get_current_datetime


class UnitRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, unit_id: UUID) -> Unit | None:
        return await self.session.scalar(
            select(Unit).where(Unit.id == unit_id, Unit.deleted_at.is_(None))
        )

    async def list_for_workspace(
        self, workspace_id: UUID, *, include_deleted: bool = False
    ) -> Sequence[Unit]:
        stmt = select(Unit).where(Unit.workspace_id == workspace_id)
        if not include_deleted:
            stmt = stmt.where(Unit.deleted_at.is_(None))
        return await self.scalars(stmt.order_by(Unit.created_at, Unit.name))

    async def colors_in_use(self, workspace_id: UUID) -> set[str]:
        rows = await self.scalars(
            select(Unit.color).where(Unit.workspace_id == workspace_id, Unit.deleted_at.is_(None))
        )
        return set(rows)

    async def ancestor_ids(self, unit_id: UUID) -> set[UUID]:
        """The unit and every unit above it."""
        chain = select(Unit.id, Unit.parent_id).where(Unit.id == unit_id).cte(recursive=True)
        chain = chain.union_all(
            select(Unit.id, Unit.parent_id).join(chain, Unit.id == chain.c.parent_id)
        )
        return set(await self.scalars(select(chain.c.id)))

    async def soft_delete(self, unit_id: UUID) -> None:
        """The unit and every unit under it."""
        tree = select(Unit.id).where(Unit.id == unit_id).cte(recursive=True)
        tree = tree.union_all(select(Unit.id).where(Unit.parent_id == tree.c.id))
        await self.session.execute(
            update(Unit)
            .where(Unit.id.in_(select(tree.c.id)), Unit.deleted_at.is_(None))
            .values(deleted_at=get_current_datetime())
            .execution_options(synchronize_session=False)
        )
