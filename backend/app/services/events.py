from __future__ import annotations

import datetime as dt
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.repositories.events import EventRepository
from app.repositories.programs import ProgramRepository
from app.schemas.event import EventCreate, EventOut, EventUpdate


class EventService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = EventRepository(session)
        self.program_repo = ProgramRepository(session)

    # ----- workspace/program scoped listing -----
    async def count_events_for_workspace(
        self,
        workspace_id: UUID,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
    ) -> int:
        return await self.repo.count_for_workspace(
            workspace_id, date_from=date_from, date_to=date_to
        )

    async def list_for_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[EventOut]:
        rows = await self.repo.list_for_workspace(
            workspace_id,
            current_user_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
        return [EventOut.from_row(event, stats) for event, stats in rows]

    async def count_events_for_program(
        self,
        workspace_id: UUID,
        program_id: UUID,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
    ) -> int:
        return await self.repo.count_for_program(
            workspace_id, program_id, date_from=date_from, date_to=date_to
        )

    async def list_for_program(
        self,
        workspace_id: UUID,
        program_id: UUID,
        current_user_id: UUID | None = None,
        *,
        date_from: dt.datetime | None = None,
        date_to: dt.datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[EventOut]:
        rows = await self.repo.list_for_program(
            workspace_id,
            program_id,
            current_user_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
        return [EventOut.from_row(event, stats) for event, stats in rows]

    # ----- creation under workspace/program -----

    async def create_under_workspace(self, workspace_id: UUID, data: EventCreate) -> EventOut:
        event = Event(workspace_id=workspace_id, program_id=None, **data.model_dump())
        await self.repo.create(event)
        await self.session.commit()
        fetched = await self.repo.get(event.id)
        if not fetched:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created event",
            )
        ev, stats = fetched
        return EventOut.from_row(ev, stats)

    async def create_under_program(self, program_id: UUID, data: EventCreate) -> EventOut:
        prog_row = await self.program_repo.get(program_id)
        if not prog_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        prog, _ = prog_row
        event = Event(
            workspace_id=prog.workspace_id,
            program_id=prog.id,
            **data.model_dump(),
        )
        await self.repo.create(event)
        await self.session.commit()
        fetched = await self.repo.get(event.id)
        if not fetched:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created event",
            )
        ev, stats = fetched
        return EventOut.from_row(ev, stats)

    # ----- item operations -----

    async def get(self, event_id: UUID, current_user_id: UUID | None = None) -> EventOut:
        row = await self.repo.get(event_id, current_user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        ev, stats = row
        return EventOut.from_row(ev, stats)

    async def get_in_program(
        self,
        event_id: UUID,
        program_id: UUID,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
    ) -> EventOut:
        row = await self.repo.get_in_program(event_id, program_id, workspace_id, current_user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        ev, stats = row
        return EventOut.from_row(ev, stats)

    async def update(
        self, event_id: UUID, data: EventUpdate, current_user_id: UUID | None = None
    ) -> EventOut:
        row = await self.repo.get(event_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        event, _ = row
        if data.program_id is not None:
            prog_row = await self.program_repo.get(data.program_id)
            if not prog_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
                )
            prog, _ = prog_row
            if prog.workspace_id != event.workspace_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Program does not belong to the same workspace as the event",
                )
            event.program_id = prog.id
        elif data.program_id is None:
            event.program_id = None
        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(event, k, v)
        await self.session.commit()
        updated = await self.repo.get(event_id, current_user_id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated event",
            )
        ev, stats = updated
        return EventOut.from_row(ev, stats)

    async def delete(self, event_id: UUID) -> None:
        row = await self.repo.get(event_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        await self.repo.delete(event_id)
        await self.session.commit()
