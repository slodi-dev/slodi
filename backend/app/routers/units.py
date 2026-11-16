# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user
from app.core.db import get_session
from app.domain.enums import WorkspaceRole
from app.schemas.unit import UnitCreate, UnitOut, UnitUpdate
from app.schemas.user import UserOut
from app.services.units import UnitService

router = APIRouter(tags=["units"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/workspaces/{workspace_id}/units", response_model=list[UnitOut])
async def list_units(
    session: SessionDep,
    workspace_id: UUID,
    include_deleted: bool = Query(
        False, description="Also deleted units, which older placements may still name"
    ),
    current_user: UserOut = Depends(get_current_user),
) -> list[UnitOut]:
    await check_workspace_access(
        workspace_id, current_user, session, WorkspaceRole.viewer, hide_from_non_members=True
    )
    return await UnitService(session).list_for_workspace(
        workspace_id, include_deleted=include_deleted
    )


@router.post(
    "/workspaces/{workspace_id}/units", response_model=UnitOut, status_code=status.HTTP_201_CREATED
)
async def create_unit(
    session: SessionDep,
    workspace_id: UUID,
    body: UnitCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> UnitOut:
    await check_workspace_access(workspace_id, current_user, session, WorkspaceRole.editor)
    unit = await UnitService(session).create(workspace_id, body)
    response.headers["Location"] = f"/units/{unit.id}"
    return unit


@router.patch("/units/{unit_id}", response_model=UnitOut)
async def update_unit(
    session: SessionDep,
    unit_id: UUID,
    body: UnitUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> UnitOut:
    svc = UnitService(session)
    await check_workspace_access(
        await svc.workspace_of(unit_id),
        current_user,
        session,
        WorkspaceRole.editor,
        hide_from_non_members=True,
    )
    return await svc.update(unit_id, body)


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit(
    session: SessionDep, unit_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    svc = UnitService(session)
    await check_workspace_access(
        await svc.workspace_of(unit_id),
        current_user,
        session,
        WorkspaceRole.editor,
        hide_from_non_members=True,
    )
    await svc.delete(unit_id)
