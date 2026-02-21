# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.schemas.content import ContentOut
from app.schemas.tag import (
    ContentTagOut,
    TagCreate,
    TagOut,
    TagUpdate,
)
from app.schemas.user import Permissions, UserOut
from app.services.content import ContentService
from app.services.tags import TagService

router = APIRouter(tags=["tags"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

DEFAULT_Q = Query(None, min_length=2, description="Case-insensitive search in tag names")

# ----- tags -----


@router.get("/tags", response_model=list[TagOut])
async def list_tags(
    session: SessionDep,
    request: Request,
    response: Response,
    q: str | None = DEFAULT_Q,
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[TagOut]:
    svc = TagService(session)
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


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    session: SessionDep,
    body: TagCreate,
    response: Response,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> TagOut:
    svc = TagService(session)
    tag = await svc.create(body)
    response.headers["Location"] = f"/tags/{tag.id}"
    return tag


@router.get("/tags/{tag_id}", response_model=TagOut)
async def get_tag(
    session: SessionDep, tag_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> TagOut:
    svc = TagService(session)
    return await svc.get(tag_id)


@router.patch("/tags/{tag_id}", response_model=TagOut)
async def update_tag(
    session: SessionDep,
    tag_id: UUID,
    body: TagUpdate,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> TagOut:
    svc = TagService(session)
    return await svc.update(tag_id, body)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    session: SessionDep,
    tag_id: UUID,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> None:
    svc = TagService(session)
    await svc.delete(tag_id)
    return None


# ----- associations -----


@router.get("/content/{content_id}/tags", response_model=list[TagOut])
async def list_content_tags(
    session: SessionDep,
    request: Request,
    response: Response,
    content_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[TagOut]:
    svc = TagService(session)
    total = await svc.count_content_tags(content_id)
    items = await svc.list_content_tags(content_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.get("/tags/{tag_id}/content", response_model=list[ContentOut])
async def list_tagged_content(
    session: SessionDep,
    request: Request,
    response: Response,
    tag_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[ContentOut]:
    svc = TagService(session)
    total = await svc.count_tagged_content(tag_id)
    items = await svc.list_tagged_content(tag_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.put(
    "/content/{content_id}/tags/{tag_id}",
    response_model=ContentTagOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_content_tag(
    session: SessionDep,
    content_id: UUID,
    tag_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> ContentTagOut:
    author_id = await ContentService(session).get_author_id(content_id)
    if author_id != current_user.id and current_user.permissions != Permissions.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the content author can add tags.",
        )

    svc = TagService(session)
    created, tag = await svc.add_content_tag(content_id, tag_id)
    if not created:
        response.status_code = status.HTTP_200_OK
    response.headers["Location"] = f"/content/{content_id}/tags/{tag_id}"
    return tag


@router.delete("/content/{content_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_content_tag(
    session: SessionDep,
    content_id: UUID,
    tag_id: UUID,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    author_id = await ContentService(session).get_author_id(content_id)
    if author_id != current_user.id and current_user.permissions != Permissions.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the content author can remove tags.",
        )

    svc = TagService(session)
    await svc.remove_content_tag(content_id, tag_id)
    return None
