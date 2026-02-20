# ruff: noqa: B008
from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.content import ContentType
from app.schemas.event import EventCreate, EventOut, EventUpdate
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceRole
from app.services.events import EventService

router = APIRouter(tags=["events"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

DEFAULT_DATE_FROM = Query(None)
DEFAULT_DATE_TO = Query(None)

# ----- collections -----


@router.get("/workspaces/{workspace_id}/events", response_model=list[EventOut])
async def list_workspace_events(
    session: SessionDep,
    workspace_id: UUID,
    request: Request,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    date_from: dt.datetime | None = DEFAULT_DATE_FROM,
    date_to: dt.datetime | None = DEFAULT_DATE_TO,
    limit: Limit = 50,
    offset: Offset = 0,
):
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = EventService(session)
    total = await svc.count_events_for_workspace(workspace_id, date_from=date_from, date_to=date_to)
    items = await svc.list_for_workspace(
        workspace_id, date_from=date_from, date_to=date_to, limit=limit, offset=offset
    )
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.get(
    "/workspaces/{workspace_id}/programs/{program_id}/events",
    response_model=list[EventOut],
)
async def list_program_events(
    session: SessionDep,
    workspace_id: UUID,
    program_id: UUID,
    request: Request,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    date_from: dt.datetime | None = DEFAULT_DATE_FROM,
    date_to: dt.datetime | None = DEFAULT_DATE_TO,
    limit: Limit = 50,
    offset: Offset = 0,
):
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = EventService(session)
    total = await svc.count_events_for_program(
        workspace_id, program_id, date_from=date_from, date_to=date_to
    )
    items = await svc.list_for_program(
        workspace_id,
        program_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.post(
    "/workspaces/{workspace_id}/events",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace_event(
    session: SessionDep,
    response: Response,
    workspace_id: UUID,
    body: EventCreate,
    current_user: UserOut = Depends(get_current_user),
):
    assert body.content_type == ContentType.event, "Content type must be 'event'"
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    svc = EventService(session)
    event = await svc.create_under_workspace(workspace_id, body)
    response.headers["Location"] = f"/events/{event.id}"
    return event


@router.post(
    "/programs/{program_id}/events",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_program_event(
    session: SessionDep,
    response: Response,
    program_id: UUID,
    body: EventCreate,
    current_user: UserOut = Depends(get_current_user),
):
    assert body.content_type == ContentType.event, "Content type must be 'event'"
    from app.services.programs import ProgramService  # Avoid circular import

    prg_svc = ProgramService(session)
    program = await prg_svc.get(program_id)
    await check_workspace_access(
        program.workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    svc = EventService(session)
    event = await svc.create_under_program(program_id, body)
    response.headers["Location"] = f"/events/{event.id}"
    return event


# ----- item endpoints -----


@router.get("/events/{event_id}", response_model=EventOut)
async def get_event(
    session: SessionDep, event_id: UUID, current_user: UserOut = Depends(get_current_user)
):
    svc = EventService(session)
    event = await svc.get(event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    return event


@router.patch("/events/{event_id}", response_model=EventOut)
async def update_event(
    session: SessionDep,
    event_id: UUID,
    body: EventUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> EventOut:
    svc = EventService(session)
    event = await svc.get(event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    return await svc.update(event_id, body)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    session: SessionDep, event_id: UUID, current_user: UserOut = Depends(get_current_user)
):
    svc = EventService(session)
    event = await svc.get(event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    await svc.delete(event_id)
    return None
