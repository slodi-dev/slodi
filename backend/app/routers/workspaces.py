# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user, require_permission
from app.core.cache import membership_cache
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.domain.enums import Permissions, WorkspaceRole
from app.schemas.user import UserOut
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceMembershipOut,
    WorkspaceMembershipUpdate,
    WorkspaceOut,
)
from app.services.workspaces import WorkspaceService

router = APIRouter(tags=["workspaces"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[UserOut, Depends(get_current_user)]


@router.get("/users/me/workspaces", response_model=list[WorkspaceOut])
async def list_my_workspaces(
    session: SessionDep,
    request: Request,
    response: Response,
    current_user: CurrentUser,
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[WorkspaceOut]:
    svc = WorkspaceService(session)
    total = await svc.count_user_workspaces(current_user.id)
    items = await svc.list_user_workspaces(current_user.id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response, request=request, total=total, limit=limit, offset=offset
    )
    return items


@router.post(
    "/users/me/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED
)
async def create_my_workspace(
    session: SessionDep, body: WorkspaceCreate, current_user: CurrentUser
) -> WorkspaceOut:
    return await WorkspaceService(session).create_user_workspace(current_user.id, body)


@router.get("/workspaces/{workspace_id}/my-role", response_model=WorkspaceMembershipOut)
async def get_my_workspace_role(
    session: SessionDep, workspace_id: UUID, response: Response, current_user: CurrentUser
) -> WorkspaceMembershipOut:
    """Your role here, or 404 if you are not a member.

    Platform admins pass every workspace check without a membership row, so they
    get an owner-level answer for the frontend to work from."""
    response.headers["Cache-Control"] = "private, max-age=120"
    if current_user.permissions == Permissions.admin:
        return WorkspaceMembershipOut(
            workspace_id=workspace_id, user_id=current_user.id, role=WorkspaceRole.owner
        )
    return await WorkspaceService(session).get_user_membership(workspace_id, current_user.id)


@router.get("/workspaces/{workspace_id}/members", response_model=list[WorkspaceMembershipOut])
async def list_workspace_members(
    session: SessionDep,
    workspace_id: UUID,
    _admin: UserOut = Depends(require_permission(Permissions.admin)),
) -> list[WorkspaceMembershipOut]:
    return await WorkspaceService(session).list_members(workspace_id)


@router.put(
    "/workspaces/{workspace_id}/members/{user_id}/role",
    response_model=WorkspaceMembershipOut,
)
async def set_member_role(
    session: SessionDep,
    workspace_id: UUID,
    user_id: UUID,
    body: WorkspaceMembershipUpdate,
    current_user: CurrentUser,
) -> WorkspaceMembershipOut:
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    result, displaced_owner_id = await WorkspaceService(session).change_member_role(
        workspace_id, user_id, body.role, current_user
    )
    await membership_cache.invalidate(user_id, workspace_id)
    if displaced_owner_id:
        await membership_cache.invalidate(displaced_owner_id, workspace_id)
    return result
