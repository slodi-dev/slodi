from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.unit_constraints import PALETTE
from app.models.unit import Unit
from app.repositories.units import UnitRepository
from app.schemas.unit import UnitCreate, UnitOut, UnitUpdate
from app.utils import get_current_datetime


class UnitService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UnitRepository(session)

    async def list_for_workspace(
        self, workspace_id: UUID, *, include_deleted: bool = False
    ) -> list[UnitOut]:
        rows = await self.repo.list_for_workspace(workspace_id, include_deleted=include_deleted)
        return [UnitOut.model_validate(r) for r in rows]

    async def workspace_of(self, unit_id: UUID) -> UUID:
        return (await self._get(unit_id)).workspace_id

    async def create(self, workspace_id: UUID, data: UnitCreate) -> UnitOut:
        if data.parent_id is not None:
            await self._check_parent(workspace_id, data.parent_id)
        unit = Unit(
            workspace_id=workspace_id,
            parent_id=data.parent_id,
            name=data.name,
            color=data.color or await self._next_color(workspace_id),
            created_at=get_current_datetime(),
        )
        await self.repo.add(unit)
        await self.session.commit()
        return UnitOut.model_validate(unit)

    async def update(self, unit_id: UUID, data: UnitUpdate) -> UnitOut:
        unit = await self._get(unit_id)
        patch = data.model_dump(exclude_unset=True)
        if patch.get("parent_id") is not None:
            await self._check_parent(unit.workspace_id, patch["parent_id"])
            if unit.id in await self.repo.ancestor_ids(patch["parent_id"]):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A unit can't be moved inside itself",
                )
        if patch.get("name") is None:
            patch.pop("name", None)
        if patch.get("color") is None:
            patch.pop("color", None)
        for k, v in patch.items():
            setattr(unit, k, v)
        await self.session.commit()
        return UnitOut.model_validate(unit)

    async def delete(self, unit_id: UUID) -> None:
        await self.repo.soft_delete((await self._get(unit_id)).id)
        await self.session.commit()

    async def _get(self, unit_id: UUID) -> Unit:
        unit = await self.repo.get(unit_id)
        if unit is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
        return unit

    async def _check_parent(self, workspace_id: UUID, parent_id: UUID) -> None:
        parent = await self.repo.get(parent_id)
        if parent is None or parent.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="parent_id must be a unit in this workspace",
            )

    async def _next_color(self, workspace_id: UUID) -> str:
        used = await self.repo.colors_in_use(workspace_id)
        unused = [c for c in PALETTE if c not in used]
        return unused[0] if unused else PALETTE[len(used) % len(PALETTE)]
