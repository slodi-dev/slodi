# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.workspace import WorkspaceRole
from app.schemas.event import EventOut
from app.schemas.troop import (
    TroopCreate,
    TroopOut,
    TroopParticipationOut,
    TroopUpdate,
)
from app.schemas.user import UserOut
from app.services.troops import TroopService

router = APIRouter(tags=["troops"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# ----- troops (workspace-scoped collection) -----


@router.get("/workspaces/{workspace_id}/troops", response_model=list[TroopOut])
async def list_workspace_troops(
    session: SessionDep,
    request: Request,
    response: Response,
    workspace_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[TroopOut]:
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = TroopService(session)
    total = await svc.count_troops_for_workspace(workspace_id)
    items = await svc.list_for_workspace(workspace_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.post(
    "/workspaces/{workspace_id}/troops",
    response_model=TroopOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace_troop(
    session: SessionDep,
    workspace_id: UUID,
    body: TroopCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> TroopOut:
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = TroopService(session)
    troop = await svc.create_under_workspace(workspace_id, body)
    response.headers["Location"] = f"/troops/{troop.id}"
    return troop


# ----- troop item -----


@router.get("/troops/{troop_id}", response_model=TroopOut)
async def get_troop(
    session: SessionDep,
    troop_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> TroopOut:
    svc = TroopService(session)
    troop = await svc.get(troop_id)

    await check_workspace_access(
        troop.workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    return troop


@router.patch("/troops/{troop_id}", response_model=TroopOut)
async def update_troop(
    session: SessionDep,
    troop_id: UUID,
    body: TroopUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> TroopOut:
    svc = TroopService(session)
    troop = await svc.get(troop_id)
    await check_workspace_access(
        troop.workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    return await svc.update(troop_id, body)


@router.delete(
    "/troops/{troop_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_troop(
    session: SessionDep,
    troop_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    svc = TroopService(session)
    troop = await svc.get(troop_id)
    await check_workspace_access(
        troop.workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    await svc.delete(troop_id)
    return None


# ----- participations -----


@router.get("/events/{event_id}/troops", response_model=list[TroopOut])
async def list_event_troops(
    session: SessionDep,
    request: Request,
    response: Response,
    event_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[TroopOut]:
    # Get event to find its workspace
    from app.services.events import EventService

    event_svc = EventService(session)
    event = await event_svc.get(event_id)

    # Check workspace access via the event's workspace
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )

    svc = TroopService(session)
    total = await svc.count_event_troops(event_id)
    items = await svc.list_event_troops(event_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.get("/troops/{troop_id}/events", response_model=list[UUID])
async def list_troop_events(
    session: SessionDep,
    request: Request,
    response: Response,
    troop_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[EventOut]:
    svc = TroopService(session)
    troop = await svc.get(troop_id)
    await check_workspace_access(
        troop.workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    total = await svc.count_troop_events(troop_id)
    items = await svc.list_troop_events(troop_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.put(
    "/events/{event_id}/troops/{troop_id}",
    response_model=TroopParticipationOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_participation(
    session: SessionDep,
    event_id: UUID,
    troop_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> TroopParticipationOut:
    svc = TroopService(session)
    troop = await svc.get(troop_id)
    await check_workspace_access(
        troop.workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    created, participation = await svc.add_participation(event_id, troop_id)
    if not created:
        response.status_code = status.HTTP_200_OK
    response.headers["Location"] = f"/events/{event_id}/troops/{troop_id}"
    return participation


@router.delete("/events/{event_id}/troops/{troop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participation(
    session: SessionDep,
    event_id: UUID,
    troop_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    svc = TroopService(session)
    troop = await svc.get(troop_id)
    await check_workspace_access(
        troop.workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    await svc.remove_participation(event_id, troop_id)
    return None
