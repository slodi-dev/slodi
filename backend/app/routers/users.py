## backend/app/routers/users.py
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.users import UserService

router = APIRouter(prefix="/users", tags=["users"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]

DEFAULT_Q = Query(None, min_length=2, description="Case-insensitive search in name/email/auth0_id")


@router.get("", response_model=list[UserOut])
async def list_users(
    session: SessionDep,
    request: Request,
    response: Response,
    q: str | None = DEFAULT_Q,
    limit: Limit = 50,
    offset: Offset = 0,
):
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
async def create_user(session: SessionDep, body: UserCreate, response: Response):
    svc = UserService(session)
    user = await svc.create(body)
    response.headers["Location"] = f"/users/{user.id}"
    return user


@router.get("/me", response_model=UserOut)
async def get_current_user_info(current_user: CurrentUser):
    """Get the currently authenticated user's information"""
    return current_user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(session: SessionDep, user_id: UUID):
    svc = UserService(session)
    return await svc.get(user_id)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(session: SessionDep, user_id: UUID, body: UserUpdate):
    svc = UserService(session)
    return await svc.update(user_id, body)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(session: SessionDep, user_id: UUID):
    svc = UserService(session)
    await svc.delete(user_id)
    return None
