# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_content_read, get_current_user, require_permission
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.core.rate_limiter import user_rate_limit
from app.domain.enums import Permissions
from app.schemas.content_report import (
    CommentReportCreate,
    ContentReportCreate,
    ContentReportOut,
    ContentReportResolve,
)
from app.schemas.moderation import ReportQueueItem
from app.schemas.user import UserOut
from app.services.comments import CommentService
from app.services.content import ContentService
from app.services.content_reports import ContentReportService

router = APIRouter(tags=["moderation"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

ModeratorDep = Depends(require_permission(Permissions.moderator))


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
    """Report an item. Open to anyone who can read it, even while suspended."""
    await check_content_read(content_id, current_user, session)
    content = await ContentService(session).get_name(content_id)
    return await ContentReportService(session).report(
        content_id, current_user.id, body, background_tasks, content
    )


@router.post(
    "/comments/{comment_id}/reports",
    response_model=ContentReportOut,
    status_code=status.HTTP_201_CREATED,
)
async def report_comment(
    session: SessionDep,
    comment_id: UUID,
    body: CommentReportCreate,
    background_tasks: BackgroundTasks,
    current_user: UserOut = Depends(get_current_user),
    _: None = Depends(user_rate_limit(20, 60)),
) -> ContentReportOut:
    """Report a comment; the report also records the item it is under."""
    comment = await CommentService(session).get_model(comment_id)
    content_id = comment.content_id

    await check_content_read(content_id, current_user, session)
    content = await ContentService(session).get_name(content_id)

    return await ContentReportService(session).report(
        content_id,
        current_user.id,
        body,
        background_tasks,
        content,
        comment_id=comment_id,
    )


@router.get("/moderation/reports", response_model=list[ReportQueueItem])
async def list_open_reports(
    session: SessionDep,
    request: Request,
    response: Response,
    current_user: UserOut = ModeratorDep,
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[ReportQueueItem]:
    """Open reports, `unsafe` first (in the query, so it holds across pages), then newest."""
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
