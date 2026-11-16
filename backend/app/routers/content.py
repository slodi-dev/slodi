# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    check_content_create,
    check_content_edit,
    get_current_user,
    require_not_suspended,
    strip_review_fields,
)
from app.core.db import get_session
from app.core.rate_limiter import user_rate_limit
from app.schemas.content import ContentCreateAtLevel, ContentOut, ContentUpdate
from app.schemas.user import UserOut
from app.services.content import ContentService, authored_by

router = APIRouter(tags=["content"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post(
    "/workspaces/{workspace_id}/content",
    response_model=ContentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_content(
    session: SessionDep,
    workspace_id: UUID,
    body: ContentCreateAtLevel,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
    _: None = Depends(user_rate_limit(20, 60)),
) -> ContentOut:
    await check_content_create(workspace_id, current_user, session)
    item = await ContentService(session).create(workspace_id, authored_by(body, current_user.id))
    response.headers["Location"] = f"/content/{item.id}"
    return item


@router.patch("/content/{content_id}", response_model=ContentOut)
async def update_content(
    session: SessionDep,
    content_id: UUID,
    body: ContentUpdate,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
) -> ContentOut:
    await check_content_edit(content_id, current_user, session)
    item = await ContentService(session).update(content_id, body, current_user.id)
    return strip_review_fields(item, current_user)


@router.delete("/content/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(
    session: SessionDep, content_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    await check_content_edit(content_id, current_user, session, deleting=True)
    await ContentService(session).delete(content_id)
