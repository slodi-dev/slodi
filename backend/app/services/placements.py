from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ContentLevel
from app.domain.placement_constraints import DEFAULT_LENGTH
from app.models.content import Content
from app.models.placement import Placement
from app.repositories.placements import PlacementRepository
from app.schemas.placement import (
    ContentSummary,
    PlacementBatchItem,
    PlacementCreate,
    PlacementOut,
    PlacementUpdate,
)
from app.services.content import copy_content
from app.utils import get_current_datetime


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _default_length(content: Content) -> dt.timedelta:
    if content.duration_min:
        return dt.timedelta(minutes=content.duration_min)
    return DEFAULT_LENGTH[ContentLevel(min(content.level, ContentLevel.season))]


class PlacementService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = PlacementRepository(session)

    async def workspace_of(self, placement_id: UUID) -> UUID:
        return (await self._get(placement_id)).workspace_id

    async def workspaces_of(self, placement_ids: Sequence[UUID]) -> set[UUID]:
        return {(await self._get(pid)).workspace_id for pid in dict.fromkeys(placement_ids)}

    async def list_for_workspace(
        self,
        workspace_id: UUID,
        *,
        top: bool | None = None,
        level: Sequence[int] | None = None,
        start: dt.datetime | None = None,
        end: dt.datetime | None = None,
    ) -> list[PlacementOut]:
        rows = await self.repo.list_for_workspace(
            workspace_id, top=top, level=level, start=start, end=end
        )
        return await self._out(rows)

    async def open(
        self,
        placement_id: UUID,
        *,
        level: Sequence[int] | None = None,
        start: dt.datetime | None = None,
        end: dt.datetime | None = None,
    ) -> list[PlacementOut]:
        rows = await self.repo.subtree(placement_id)
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Placement not found")
        by_id = {p.id: p for p in rows}
        in_range: dict[UUID, bool] = {}

        def overlaps(p: Placement) -> bool:
            if p.id not in in_range:
                own = (start is None or p.ends_at >= start) and (end is None or p.starts_at <= end)
                parent = (
                    by_id.get(p.parent_id)
                    if p.parent_id is not None and p.parent_id != placement_id
                    else None
                )
                in_range[p.id] = own or (parent is not None and overlaps(parent))
            return in_range[p.id]

        kept = [
            p
            for p in rows
            if p.id == placement_id or (overlaps(p) and (not level or p.content_level in level))
        ]
        return await self._out(kept)

    async def create(self, workspace_id: UUID, data: PlacementCreate) -> PlacementOut:
        content = await self.repo.get_content(data.content_id)
        if content is None or content.workspace_id != workspace_id:
            raise _unprocessable("content_id must be content in this workspace")
        placement = Placement(
            workspace_id=workspace_id,
            content_id=content.id,
            content_level=content.level,
            starts_at=data.starts_at,
            ends_at=data.ends_at or data.starts_at + _default_length(content),
            time_set=data.time_set,
            created_at=get_current_datetime(),
        )
        if data.parent_id is not None:
            await self._attach(placement, data.parent_id)
        self._check_times(placement)
        await self.repo.add(placement)
        await self.session.flush()
        if data.unit_ids:
            await self._set_units(placement, data.unit_ids)
        await self._commit()
        return (await self._out(await self.repo.get_many([placement.id])))[0]

    async def update(self, placement_id: UUID, data: PlacementUpdate) -> list[PlacementOut]:
        await self._apply(await self._get(placement_id), data)
        await self._commit()
        return await self.open(placement_id)

    async def update_many(self, items: Sequence[PlacementBatchItem]) -> list[PlacementOut]:
        for item in items:
            await self._apply(await self._get(item.id), item)
        await self._commit()
        return await self._out(await self.repo.get_many([i.id for i in items]))

    async def get_many(self, placement_ids: Sequence[UUID]) -> list[PlacementOut]:
        return await self._out(await self.repo.get_many(placement_ids))

    async def clone(
        self,
        rows: Sequence[Placement],
        *,
        workspace_id: UUID,
        delta: dt.timedelta,
        parent_id: UUID | None,
        content_ids: dict[UUID, UUID] | None = None,
        keep_units: bool = True,
    ) -> UUID:
        """A new copy of a subtree (parents first); returns the new top placement's id."""
        new_ids: dict[UUID, UUID] = {}
        units = await self.repo.unit_ids([p.id for p in rows]) if keep_units else {}
        top = rows[0]
        for p in rows:
            copy = Placement(
                id=uuid4(),
                workspace_id=workspace_id,
                content_id=(content_ids or {}).get(p.content_id, p.content_id),
                content_level=p.content_level,
                starts_at=p.starts_at + delta,
                ends_at=p.ends_at + delta,
                time_set=p.time_set,
                created_at=get_current_datetime(),
            )
            if p is top:
                if parent_id is not None:
                    await self._attach(copy, parent_id)
            elif p.parent_id is not None:
                copy.parent_id, copy.parent_level = new_ids[p.parent_id], p.parent_level
            new_ids[p.id] = copy.id
            self.session.add(copy)
            await self.session.flush()
            if units.get(p.id):
                await self.repo.set_units(copy.id, units[p.id])
        return new_ids[top.id]

    async def copy(
        self,
        placement_id: UUID,
        starts: Sequence[dt.datetime],
        parent_id: UUID | None,
        *,
        same_parent: bool,
    ) -> list[PlacementOut]:
        rows = await self.repo.subtree_rows(placement_id)
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Placement not found")
        top = rows[0]
        target_parent = top.parent_id if same_parent else parent_id
        new_ids = [
            await self.clone(
                rows,
                workspace_id=top.workspace_id,
                delta=start - top.starts_at,
                parent_id=target_parent,
            )
            for start in starts
        ]
        await self._commit()
        return await self.get_many(new_ids)

    async def own_version(self, placement_id: UUID, author_id: UUID) -> PlacementOut:
        placement = await self._get(placement_id)
        source = await self.repo.get_content(placement.content_id)
        if source is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        copy = await copy_content(self.session, source, placement.workspace_id, author_id)
        placement.content_id = copy.id
        await self._commit()
        return (await self.get_many([placement_id]))[0]

    async def delete(self, placement_id: UUID) -> None:
        await self.repo.delete(await self._get(placement_id))
        await self.session.commit()

    async def _apply(self, placement: Placement, data: PlacementUpdate) -> None:
        patch = data.model_dump(exclude_unset=True, exclude={"id"})
        if "parent_id" in patch:
            if patch["parent_id"] is None:
                placement.parent_id, placement.parent_level = None, None
            else:
                await self._attach(placement, patch["parent_id"])
        starts, ends = patch.get("starts_at"), patch.get("ends_at")
        if starts is not None:
            delta = starts - placement.starts_at
            if delta:
                await self.repo.shift_below(placement.id, delta)
            placement.starts_at = starts
            if ends is None:
                placement.ends_at = placement.ends_at + delta
        if ends is not None:
            placement.ends_at = ends
        self._check_times(placement)
        if patch.get("time_set") is not None:
            placement.time_set = patch["time_set"]
        if patch.get("unit_ids") is not None:
            await self._set_units(placement, patch["unit_ids"])

    async def _attach(self, placement: Placement, parent_id: UUID) -> None:
        parent = await self.repo.get(parent_id)
        if parent is None or parent.workspace_id != placement.workspace_id:
            raise _unprocessable("parent_id must be a placement in this workspace")
        if placement.content_level >= parent.content_level:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The parent's level must be higher than this item's",
            )
        placement.parent_id, placement.parent_level = parent.id, parent.content_level

    async def _set_units(self, placement: Placement, unit_ids: Sequence[UUID]) -> None:
        live = await self.repo.units_in_workspace(placement.workspace_id, unit_ids)
        kept = (await self.repo.unit_ids([placement.id])).get(placement.id, [])
        if not set(unit_ids) <= live | set(kept):
            raise _unprocessable("unit_ids must be units in this workspace")
        await self.repo.set_units(placement.id, unit_ids)

    @staticmethod
    def _check_times(placement: Placement) -> None:
        if placement.ends_at < placement.starts_at:
            raise _unprocessable("ends_at can't be before starts_at")

    async def _get(self, placement_id: UUID) -> Placement:
        placement = await self.repo.get(placement_id)
        if placement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Placement not found")
        return placement

    async def _commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="That breaks a placement rule"
            ) from None

    async def _out(self, rows: Sequence[Placement]) -> list[PlacementOut]:
        units = await self.repo.unit_ids([p.id for p in rows])
        used = await self.repo.times_used(list({p.content_id for p in rows}))
        return [
            PlacementOut(
                id=p.id,
                workspace_id=p.workspace_id,
                parent_id=p.parent_id,
                content=ContentSummary(
                    id=p.content.id,
                    level=p.content.level,
                    name=p.content.name,
                    duration_min=p.content.duration_min,
                    duration_max=p.content.duration_max,
                    location=p.content.location,
                    tags=[t.name for t in p.content.tags],
                    equipment=p.content.equipment or [],
                    times_used=used.get(p.content_id, 0),
                    hidden=p.content.hidden_at is not None,
                ),
                starts_at=p.starts_at,
                ends_at=p.ends_at,
                time_set=p.time_set,
                unit_ids=units.get(p.id, []),
            )
            for p in rows
        ]
