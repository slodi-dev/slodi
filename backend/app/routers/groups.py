# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_group_access, get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.group import GroupRole
from app.schemas.group import (
    GroupCreate,
    GroupMemberOut,
    GroupMembershipCreate,
    GroupMembershipOut,
    GroupMembershipUpdate,
    GroupOut,
    GroupUpdate,
)
from app.schemas.user import UserOut
from app.services.groups import GroupService

router = APIRouter(tags=["groups"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

DEFAULT_Q = Query(None, min_length=2, description="Case-insensitive search in group name")

# ----- groups -----


@router.get("/groups", response_model=list[GroupOut])
async def list_groups(
    session: SessionDep,
    request: Request,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    q: str | None = DEFAULT_Q,
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[GroupOut]:
    svc = GroupService(session)
    total = await svc.count(q=q)
    items = await svc.list(q=q, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.post("/groups", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    session: SessionDep,
    body: GroupCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> GroupOut:
    svc = GroupService(session)
    group = await svc.create(body)
    response.headers["Location"] = f"/groups/{group.id}"
    return group


@router.get("/groups/{group_id}", response_model=GroupOut)
async def get_group(
    session: SessionDep,
    group_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> GroupOut:
    svc = GroupService(session)
    return await svc.get(group_id)


@router.patch("/groups/{group_id}", response_model=GroupOut)
async def update_group(
    session: SessionDep,
    group_id: UUID,
    body: GroupUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> GroupOut:
    await check_group_access(group_id, current_user, session, minimum_role=GroupRole.admin)
    svc = GroupService(session)
    return await svc.update(group_id, body)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    session: SessionDep,
    group_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    await check_group_access(group_id, current_user, session, minimum_role=GroupRole.owner)
    svc = GroupService(session)
    await svc.delete(group_id)
    return None


# ----- memberships -----


@router.get("/groups/{group_id}/memberships", response_model=list[GroupMemberOut])
async def list_group_members(
    session: SessionDep,
    request: Request,
    response: Response,
    group_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[GroupMemberOut]:
    svc = GroupService(session)
    total = await svc.count_group_members(group_id)
    items = await svc.list_group_members(group_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.get("/users/{user_id}/groups", response_model=list[GroupOut])
async def list_user_groups(
    session: SessionDep,
    request: Request,
    response: Response,
    user_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[GroupOut]:
    svc = GroupService(session)
    total = await svc.count_user_groups(user_id)
    items = await svc.list_user_groups(user_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.post(
    "/groups/{group_id}/memberships",
    response_model=GroupMembershipOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_group_membership(
    session: SessionDep,
    group_id: UUID,
    body: GroupMembershipCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> GroupMembershipOut:
    await check_group_access(group_id, current_user, session, minimum_role=GroupRole.admin)
    svc = GroupService(session)
    created, group_membership = await svc.add_membership(group_id, body)
    if not created:
        response.status_code = status.HTTP_200_OK
    response.headers["Location"] = f"/groups/{group_id}/memberships/{group_membership.user_id}"
    return group_membership


@router.patch(
    "/groups/{group_id}/memberships/{user_id}",
    response_model=GroupMembershipOut,
)
async def update_group_member(
    session: SessionDep,
    group_id: UUID,
    user_id: UUID,
    body: GroupMembershipUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> GroupMembershipOut:
    await check_group_access(group_id, current_user, session, minimum_role=GroupRole.admin)
    svc = GroupService(session)
    return await svc.update_membership(group_id, user_id, body)


@router.delete(
    "/groups/{group_id}/memberships/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def leave_group(
    session: SessionDep,
    group_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    svc = GroupService(session)
    await svc.remove_membership(group_id, current_user.id)
    return None


@router.delete(
    "/groups/{group_id}/memberships/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_group_member(
    session: SessionDep,
    group_id: UUID,
    user_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    await check_group_access(group_id, current_user, session, minimum_role=GroupRole.admin)
    svc = GroupService(session)
    await svc.remove_membership(group_id, user_id)
    return None
