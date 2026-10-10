from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.troop import Troop
from app.repositories.troops import TroopRepository
from app.schemas.event import EventOut
from app.schemas.troop import (
    TroopCreate,
    TroopOut,
    TroopParticipationOut,
    TroopUpdate,
)


class TroopService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TroopRepository(session)

    # ----- troops -----
    async def count_troops_for_workspace(self, workspace_id: UUID) -> int:
        return await self.repo.count_troops_for_workspace(workspace_id)

    async def list_for_workspace(
        self, workspace_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[TroopOut]:
        rows = await self.repo.list_for_workspace(workspace_id, limit=limit, offset=offset)
        return [TroopOut.model_validate(r) for r in rows]

    async def create_under_workspace(self, workspace_id: UUID, data: TroopCreate) -> TroopOut:
        troop = Troop(
            name=data.name,
            workspace_id=workspace_id,
        )
        await self.repo.create(troop)
        await self.session.commit()
        await self.session.refresh(troop)
        return TroopOut.model_validate(troop)

    async def get(self, troop_id: UUID) -> TroopOut:
        row = await self.repo.get(troop_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Troop not found")
        return TroopOut.model_validate(row)

    async def update(self, troop_id: UUID, data: TroopUpdate) -> TroopOut:
        row = await self.repo.get(troop_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Troop not found")
        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(row, k, v)
        await self.session.commit()
        await self.session.refresh(row)
        return TroopOut.model_validate(row)

    async def delete(self, troop_id: UUID) -> None:
        deleted = await self.repo.delete(troop_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Troop not found")
        await self.session.commit()

    # ----- participations -----

    async def count_event_troops(self, event_id: UUID) -> int:
        return await self.repo.count_event_troops(event_id)

    async def list_event_troops(
        self, event_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[TroopOut]:
        rows = await self.repo.list_event_troops(event_id, limit=limit, offset=offset)
        return [TroopOut.model_validate(r) for r in rows]

    async def count_troop_events(self, troop_id: UUID) -> int:
        return await self.repo.count_troop_events(troop_id)

    async def list_troop_events(
        self, troop_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[EventOut]:
        rows = await self.repo.list_troop_events(troop_id, limit=limit, offset=offset)
        return [EventOut.model_validate(r) for r in rows]

    async def add_participation(
        self, event_id: UUID, troop_id: UUID
    ) -> tuple[bool, TroopParticipationOut]:
        troop = await self.repo.get(troop_id)
        if not troop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Troop not found")
        # A troop can only take part in its own workspace's events. Without
        # this, a troop admin could attach their troop to any event id at all,
        # including deleted ones and events in workspaces they cannot see.
        if not await self.repo.event_in_workspace(event_id, troop.workspace_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        try:
            created, tp = await self.repo.add_participation(event_id, troop_id)
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            # duplicate composite key or missing FK
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Participation already exists or violates constraints",
            ) from None
        return created, TroopParticipationOut.model_validate(tp)

    async def remove_participation(self, event_id: UUID, troop_id: UUID) -> None:
        deleted = await self.repo.remove_participation(event_id, troop_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Participation not found"
            )
        await self.session.commit()
