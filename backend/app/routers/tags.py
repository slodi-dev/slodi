# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.cache import tags_cache
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.domain.enums import Permissions
from app.schemas.tag import TagCreate, TagOut, TagUpdate
from app.schemas.user import UserOut
from app.services.tags import TagService

router = APIRouter(tags=["tags"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]
# The vocabulary is shared by the whole bank, so changing it is Dagskrárstjórnarteymið's job.
Moderator = Annotated[UserOut, Depends(require_permission(Permissions.moderator))]


@router.get("/tags", response_model=list[TagOut])
async def list_tags(
    session: SessionDep,
    request: Request,
    response: Response,
    q: str | None = Query(None, min_length=2, description="Search tag names, any case"),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[TagOut]:
    # The full list is cached and paged in memory; a search goes to the database.
    cached = await tags_cache.get() if q is None else None
    if cached is not None:
        total, items = len(cached), cached[offset : offset + limit]
    else:
        svc = TagService(session)
        total = await svc.count(q=q)
        items = await svc.list_all(q=q, limit=limit, offset=offset)
        if q is None and offset == 0 and len(items) == total:
            await tags_cache.set(items)
    add_pagination_headers(
        response=response, request=request, total=total, limit=limit, offset=offset
    )
    return items


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(session: SessionDep, body: TagCreate, _moderator: Moderator) -> TagOut:
    tag = await TagService(session).create(body)
    await tags_cache.invalidate()
    return tag


@router.patch("/tags/{tag_id}", response_model=TagOut)
async def update_tag(
    session: SessionDep, tag_id: UUID, body: TagUpdate, _moderator: Moderator
) -> TagOut:
    updated = await TagService(session).update(tag_id, body)
    await tags_cache.invalidate()
    return updated


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(session: SessionDep, tag_id: UUID, _moderator: Moderator) -> None:
    await TagService(session).delete(tag_id)
    await tags_cache.invalidate()
