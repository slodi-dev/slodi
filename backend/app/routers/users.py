# ruff: noqa: B008
from __future__ import annotations

from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.cache import user_cache
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.domain.enums import Permissions
from app.schemas.posting_suspension import SuspensionOut
from app.schemas.user import UserOut, UserUpdateAdmin, UserUpdateSelf
from app.services.posting_suspensions import PostingSuspensionService
from app.services.users import UserService

router = APIRouter(prefix="/users", tags=["users"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[UserOut, Depends(get_current_user)]
PlatformAdmin = Annotated[UserOut, Depends(require_permission(Permissions.admin))]


@router.get("/me", response_model=UserOut)
async def get_current_user_info(current_user: CurrentUser) -> UserOut:
    return current_user


@router.get("/me/suspension", response_model=SuspensionOut | None)
async def my_suspension(session: SessionDep, current_user: CurrentUser) -> SuspensionOut | None:
    """Your own active suspension, if any, so the bank can say so before you write."""
    return await PostingSuspensionService(session).active(current_user.id)


@router.patch("/me", response_model=UserOut)
async def update_current_user(
    session: SessionDep, body: UserUpdateSelf, current_user: CurrentUser
) -> UserOut:
    updated = await UserService(session).update(current_user.id, body)
    await user_cache.invalidate(current_user.auth0_id)
    return updated


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(session: SessionDep, current_user: CurrentUser) -> None:
    await UserService(session).delete(current_user.id)
    await user_cache.invalidate(current_user.auth0_id)


@router.get("/admin/list", response_model=list[UserOut])
async def list_users_admin(
    session: SessionDep,
    request: Request,
    response: Response,
    _admin: PlatformAdmin,
    q: str | None = Query(None, min_length=2, description="Search name, email or auth0_id"),
    limit: Limit = 50,
    offset: Offset = 0,
) -> Sequence[UserOut]:
    svc = UserService(session)
    total = await svc.count(q=q)
    items = await svc.list_full(q=q, limit=limit, offset=offset)
    add_pagination_headers(
        response=response, request=request, total=total, limit=limit, offset=offset
    )
    return items


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    session: SessionDep, user_id: UUID, body: UserUpdateAdmin, _admin: PlatformAdmin
) -> UserOut:
    updated = await UserService(session).update(user_id, body)
    await user_cache.invalidate(updated.auth0_id)
    return updated


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(session: SessionDep, user_id: UUID, _admin: PlatformAdmin) -> None:
    auth0_id = await UserService(session).delete_by_admin(user_id)
    await user_cache.invalidate(auth0_id)
