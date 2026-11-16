# ruff: noqa: B008
from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user
from app.core.db import get_session
from app.domain.enums import WorkspaceRole
from app.schemas.placement import (
    PlacementBatchItem,
    PlacementCreate,
    PlacementOut,
    PlacementUpdate,
)
from app.schemas.user import UserOut
from app.services.placements import PlacementService

router = APIRouter(tags=["placements"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]
Levels = Annotated[list[int] | None, Query(description="0 task, 1 event, 2 program, 3 season")]
From = Annotated[dt.datetime | None, Query(alias="from", description="Overlapping from")]
To = Annotated[dt.datetime | None, Query(alias="to", description="Overlapping until")]


@router.get("/workspaces/{workspace_id}/placements", response_model=list[PlacementOut])
async def list_placements(
    session: SessionDep,
    workspace_id: UUID,
    top: bool | None = Query(None, description="Only placements with no parent"),
    level: Levels = None,
    start: From = None,
    end: To = None,
    current_user: UserOut = Depends(get_current_user),
) -> list[PlacementOut]:
    """For finding something to open; nothing below each match is included."""
    await check_workspace_access(
        workspace_id, current_user, session, WorkspaceRole.viewer, hide_from_non_members=True
    )
    return await PlacementService(session).list_for_workspace(
        workspace_id, top=top, level=level, start=start, end=end
    )


@router.get("/placements/{placement_id}", response_model=list[PlacementOut])
async def open_placement(
    session: SessionDep,
    placement_id: UUID,
    level: Levels = None,
    start: From = None,
    end: To = None,
    current_user: UserOut = Depends(get_current_user),
) -> list[PlacementOut]:
    """The placement and everything under it, flat."""
    svc = PlacementService(session)
    await check_workspace_access(
        await svc.workspace_of(placement_id),
        current_user,
        session,
        WorkspaceRole.viewer,
        hide_from_non_members=True,
    )
    return await svc.open(placement_id, level=level, start=start, end=end)


@router.post(
    "/workspaces/{workspace_id}/placements",
    response_model=PlacementOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_placement(
    session: SessionDep,
    workspace_id: UUID,
    body: PlacementCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> PlacementOut:
    await check_workspace_access(workspace_id, current_user, session, WorkspaceRole.editor)
    placement = await PlacementService(session).create(workspace_id, body)
    response.headers["Location"] = f"/placements/{placement.id}"
    return placement


@router.patch("/placements", response_model=list[PlacementOut])
async def update_placements(
    session: SessionDep,
    body: list[PlacementBatchItem],
    current_user: UserOut = Depends(get_current_user),
) -> list[PlacementOut]:
    """Several changes as one: all or none."""
    svc = PlacementService(session)
    for workspace_id in await svc.workspaces_of([item.id for item in body]):
        await check_workspace_access(
            workspace_id, current_user, session, WorkspaceRole.editor, hide_from_non_members=True
        )
    return await svc.update_many(body)


@router.patch("/placements/{placement_id}", response_model=list[PlacementOut])
async def update_placement(
    session: SessionDep,
    placement_id: UUID,
    body: PlacementUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> list[PlacementOut]:
    """Returns the placement and everything under it; a new start moves all of it."""
    svc = PlacementService(session)
    await check_workspace_access(
        await svc.workspace_of(placement_id),
        current_user,
        session,
        WorkspaceRole.editor,
        hide_from_non_members=True,
    )
    return await svc.update(placement_id, body)


@router.delete("/placements/{placement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_placement(
    session: SessionDep, placement_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    svc = PlacementService(session)
    await check_workspace_access(
        await svc.workspace_of(placement_id),
        current_user,
        session,
        WorkspaceRole.editor,
        hide_from_non_members=True,
    )
    await svc.delete(placement_id)
