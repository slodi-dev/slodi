from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.repositories.events import EventRepository
from app.repositories.programs import ProgramRepository
from app.schemas.event import EventCreate, EventOut, EventUpdate
from app.services.content import requeue_if_author_fixed, set_tags
from app.services.uploads import AttachmentVerifier


class EventService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = EventRepository(session)

    async def create_under_workspace(self, workspace_id: UUID, data: EventCreate) -> EventOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        event = Event(workspace_id=workspace_id, **data.model_dump(exclude={"tag_names"}))
        await self.repo.create(event)
        await self.session.flush()
        if data.tag_names:
            await set_tags(self.session, event.id, data.tag_names)
        await self.session.commit()
        return await self.get(event.id)

    async def get(
        self,
        event_id: UUID,
        current_user_id: UUID | None = None,
        *,
        include_hidden: bool = False,
        include_hidden_children: bool = False,
    ) -> EventOut:
        row = await self.repo.get(
            event_id,
            current_user_id,
            include_hidden=include_hidden,
            include_hidden_children=include_hidden_children,
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        return EventOut.from_row(*row)

    async def update(
        self, event_id: UUID, data: EventUpdate, current_user_id: UUID | None = None
    ) -> EventOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        row = await self.repo.get(event_id, include_hidden=True)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        event, _ = row
        if data.program_id is not None:
            program = await ProgramRepository(self.session).get(data.program_id)
            if not program:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
                )
            if program[0].workspace_id != event.workspace_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Program does not belong to the same workspace as the event",
                )
        for k, v in data.model_dump(exclude_unset=True, exclude={"tag_names"}).items():
            setattr(event, k, v)
        requeue_if_author_fixed(event, current_user_id)
        if "tag_names" in data.model_fields_set:
            await set_tags(self.session, event_id, data.tag_names or [])
        await self.session.commit()
        return await self.get(event_id, current_user_id, include_hidden=True)

    async def delete(self, event_id: UUID) -> None:
        if not await self.repo.get(event_id, include_hidden=True):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        await self.repo.delete(event_id)
        await self.session.commit()
