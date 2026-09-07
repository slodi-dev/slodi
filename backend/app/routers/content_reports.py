# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_content_workspace_access, get_current_user, require_permission
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.core.rate_limiter import user_rate_limit
from app.domain.enums import Permissions
from app.schemas.content_report import (
    ContentReportCreate,
    ContentReportOut,
    ContentReportResolve,
)
from app.schemas.user import UserOut
from app.services.content import ContentService
from app.services.content_reports import ContentReportService

router = APIRouter(tags=["moderation"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

# The review board is `moderator`+ work, but that permission does not exist yet —
# it arrives with the Yfirferð board (sc-430), which adds it to the Permissions
# enum between `member` and `admin`. Until then these are admin-only. Because
# `require_permission` compares by rank, lowering them to `moderator` later is a
# one-word change here and admins keep passing for free.
ModeratorDep = Depends(require_permission(Permissions.admin))


@router.post(
    "/content/{content_id}/reports",
    response_model=ContentReportOut,
    status_code=status.HTTP_201_CREATED,
)
async def report_content(
    session: SessionDep,
    content_id: UUID,
    body: ContentReportCreate,
    background_tasks: BackgroundTasks,
    current_user: UserOut = Depends(get_current_user),
    _: None = Depends(user_rate_limit(20, 60)),
) -> ContentReportOut:
    """Flag something that does not belong.

    Open to any member who can see the item — including someone currently in
    skammarkrókur. Taking the ability to flag genuinely unsafe content away from
    someone who is themselves under review helps nobody.
    """
    await check_content_workspace_access(content_id, current_user, session)
    content = await ContentService(session).get_name(content_id)
    return await ContentReportService(session).report(
        content_id, current_user.id, body, background_tasks, content
    )


@router.get("/moderation/reports", response_model=list[ContentReportOut])
async def list_open_reports(
    session: SessionDep,
    request: Request,
    response: Response,
    current_user: UserOut = ModeratorDep,
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[ContentReportOut]:
    """The open queue — `unsafe` pinned first, then newest.

    Pinned in the query rather than in the board, so the ordering survives
    paging: an escalation on page two is an escalation nobody sees.
    """
    svc = ContentReportService(session)
    total = await svc.count_open()
    items = await svc.list_open(limit=limit, offset=offset)
    add_pagination_headers(
        response=response, request=request, total=total, limit=limit, offset=offset
    )
    return items


@router.patch("/moderation/reports/{report_id}", response_model=ContentReportOut)
async def resolve_report(
    session: SessionDep,
    report_id: UUID,
    body: ContentReportResolve,
    current_user: UserOut = ModeratorDep,
) -> ContentReportOut:
    """Close a report as resolved or dismissed."""
    return await ContentReportService(session).resolve(report_id, current_user.id, body)
