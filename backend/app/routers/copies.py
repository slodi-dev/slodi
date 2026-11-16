# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    check_content_create,
    check_content_read,
    check_workspace_access,
    get_current_user,
    require_not_suspended,
)
from app.core.db import get_session
from app.core.rate_limiter import user_rate_limit
from app.domain.enums import WorkspaceRole
from app.schemas.copy import CopyCreate, CopyOut, CopyPreview
from app.schemas.user import UserOut
from app.services.copies import CopyService

router = APIRouter(tags=["copies"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/workspaces/{workspace_id}/copies/preview", response_model=CopyPreview)
async def preview_copy(
    session: SessionDep,
    workspace_id: UUID,
    source_id: UUID = Query(...),
    current_user: UserOut = Depends(get_current_user),
) -> CopyPreview:
    """Which pieces of the source this workspace already has copies of."""
    await check_content_read(source_id, current_user, session)
    await check_workspace_access(
        workspace_id, current_user, session, WorkspaceRole.viewer, hide_from_non_members=True
    )
    return await CopyService(session).preview(workspace_id, source_id)


@router.post(
    "/workspaces/{workspace_id}/copies",
    response_model=CopyOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_copy(
    session: SessionDep,
    workspace_id: UUID,
    body: CopyCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
    _: None = Depends(user_rate_limit(20, 60)),
) -> CopyOut:
    """Copy, and optionally place: the content, and its structure if it has one."""
    await check_content_read(body.source_id, current_user, session)
    await check_content_create(workspace_id, current_user, session)
    copy = await CopyService(session).copy(workspace_id, body, current_user.id)
    response.headers["Location"] = f"/content/{copy.content.id}"
    return copy
