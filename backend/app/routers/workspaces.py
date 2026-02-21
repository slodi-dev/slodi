# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.user import Permissions
from app.models.workspace import WorkspaceRole
from app.schemas.user import UserOut
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceMembershipOut,
    WorkspaceOut,
    WorkspaceUpdate,
)
from app.services.workspaces import WorkspaceService

router = APIRouter(tags=["workspaces"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/users/{user_id}/workspaces", response_model=list[WorkspaceOut])
async def list_user_workspaces(
    session: SessionDep,
    request: Request,
    response: Response,
    user_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[WorkspaceOut]:
    # Check user ID in path matches current user or is admin
    if current_user.id != user_id and current_user.permissions != Permissions.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own workspaces.",
        )

    svc = WorkspaceService(session)
    total = await svc.count_user_workspaces(user_id)
    items = await svc.list_user_workspaces(user_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.post(
    "/users/{user_id}/workspaces",
    response_model=WorkspaceOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_user_workspace(
    session: SessionDep,
    user_id: UUID,
    body: WorkspaceCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> WorkspaceOut:
    # Check user ID in path matches current user or is admin
    if current_user.id != user_id and current_user.permissions != Permissions.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create workspaces for yourself.",
        )

    svc = WorkspaceService(session)
    workspace = await svc.create_user_workspace(user_id, body)
    response.headers["Location"] = f"/workspaces/{workspace.id}"
    return workspace


@router.get("/workspaces/{workspace_id}/my-role", response_model=WorkspaceMembershipOut)
async def get_my_workspace_role(
    session: SessionDep,
    workspace_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> WorkspaceMembershipOut:
    """Return the current user's membership/role for a workspace, or 404 if not a member.

    Platform admins bypass all workspace membership checks in the rest of the API, so
    they may not have a membership row. Return a synthetic owner-level membership so the
    frontend can correctly infer their edit / delete permissions.
    """
    if current_user.permissions == Permissions.admin:
        return WorkspaceMembershipOut(
            workspace_id=workspace_id,
            user_id=current_user.id,
            role=WorkspaceRole.owner,
        )
    svc = WorkspaceService(session)
    return await svc.get_user_membership(workspace_id, current_user.id)


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    session: SessionDep,
    workspace_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> WorkspaceOut:
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = WorkspaceService(session)
    return await svc.get(workspace_id)


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
async def update_workspace(
    session: SessionDep,
    workspace_id: UUID,
    body: WorkspaceUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> WorkspaceOut:
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    svc = WorkspaceService(session)
    return await svc.update(workspace_id, body)


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    session: SessionDep,
    workspace_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.owner
    )
    svc = WorkspaceService(session)
    await svc.delete(workspace_id)
    return None
