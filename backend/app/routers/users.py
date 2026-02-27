## backend/app/routers/users.py
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.user import Permissions
from app.schemas.user import UserCreate, UserOut, UserOutLimited, UserUpdateAdmin, UserUpdateSelf
from app.services.users import UserService

router = APIRouter(prefix="/users", tags=["users"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[UserOut, Depends(get_current_user)]

DEFAULT_Q = Query(None, min_length=2, description="Case-insensitive search in name/email/auth0_id")


@router.get("", response_model=list[UserOut])
async def list_users(
    session: SessionDep,
    request: Request,
    response: Response,
    current_user: UserOut = Depends(get_current_user),  # noqa: B008
    q: str | None = DEFAULT_Q,
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[UserOut]:
    svc = UserService(session)
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


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    session: SessionDep,
    body: UserCreate,
    response: Response,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),  # noqa: B008
) -> UserOut:
    svc = UserService(session)
    user = await svc.create(body)
    response.headers["Location"] = f"/users/{user.id}"
    return user


@router.get("/me", response_model=UserOut)
async def get_current_user_info(
    current_user: UserOut = Depends(get_current_user),  # noqa: B008
) -> UserOut:
    """Get the current user's own profile"""
    return current_user


@router.get("/{user_id}", response_model=UserOutLimited)
async def get_user(
    session: SessionDep,
    user_id: UUID,
    current_user: UserOut = Depends(get_current_user),  # noqa: B008
) -> UserOutLimited:
    """Get any user's public profile (if allowed)"""
    svc = UserService(session)
    return await svc.get(user_id)


@router.patch("/me", response_model=UserOut)
async def update_current_user(
    session: SessionDep,
    body: UserUpdateSelf,  # Restricted schema
    current_user: UserOut = Depends(get_current_user),  # noqa: B008
) -> UserOut:
    svc = UserService(session)
    return await svc.update(current_user.id, body)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    session: SessionDep,
    user_id: UUID,
    body: UserUpdateAdmin,  # Full schema
    current_user: UserOut = Depends(require_permission(Permissions.admin)),  # noqa: B008
) -> UserOut:
    svc = UserService(session)
    return await svc.update(user_id, body)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    session: SessionDep,
    current_user: UserOut = Depends(get_current_user),  # noqa: B008
) -> None:
    svc = UserService(session)
    await svc.delete(current_user.id)
    return None


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    session: SessionDep,
    user_id: UUID,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),  # noqa: B008
) -> None:
    svc = UserService(session)
    await svc.delete(user_id)
    return None
