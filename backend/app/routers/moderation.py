# ruff: noqa: B008
from __future__ import annotations

import datetime as dt
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.domain.enums import ContentType, Permissions, ReviewState
from app.schemas.moderation import (
    ReviewCommentCreate,
    ReviewCommentOut,
    ReviewDecision,
    ReviewDetail,
    ReviewFilters,
    ReviewQueueItem,
    UnreviewedCount,
)
from app.schemas.posting_suspension import (
    AuthorStanding,
    SuspensionCreate,
    SuspensionLift,
    SuspensionOut,
)
from app.schemas.user import UserOut
from app.services.moderation import ModerationService
from app.services.posting_suspensions import PostingSuspensionService

# Admins outrank moderators, so they pass too.
ModeratorDep = Depends(require_permission(Permissions.moderator))
SessionDep = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter(prefix="/moderation", tags=["moderation"], dependencies=[ModeratorDep])


@router.get("/unreviewed-count", response_model=UnreviewedCount)
async def unreviewed_count(
    session: SessionDep,
    current_user: UserOut = ModeratorDep,
) -> UnreviewedCount:
    """The sidebar badge, without fetching the board.

    `/queue` reports the same number in `X-Unreviewed-Total`, which is the
    right shape for the Yfirferð page: it already has the response in hand and
    can move the badge after a review without asking again. The sidebar has no
    such response, renders on every authenticated page, and wants one number.
    """
    return UnreviewedCount(count=await ModerationService(session).count_unreviewed())


@router.get("/queue", response_model=list[ReviewQueueItem])
async def review_queue(
    session: SessionDep,
    request: Request,
    response: Response,
    review_state: ReviewState | Literal["all"] = Query(
        ReviewState.unreviewed, description="A ReviewState, or 'all' for every state."
    ),
    content_type: ContentType | None = Query(None),
    reported: bool | None = Query(None, description="Only items with open reports."),
    search: str | None = Query(None, max_length=200, description="Substring of the name."),
    author: str | None = Query(None, max_length=200, description="Substring of the author's name."),
    date_from: dt.date | None = Query(None),
    date_to: dt.date | None = Query(None),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[ReviewQueueItem]:
    """The board's list; defaults to the unreviewed queue."""
    filters = ReviewFilters(
        review_state=None if review_state == "all" else review_state,
        content_type=content_type,
        reported=reported,
        search=search,
        author=author,
        date_from=date_from,
        date_to=date_to,
    )
    svc = ModerationService(session)
    total = await svc.count(filters)
    items = await svc.queue(filters, limit=limit, offset=offset)
    add_pagination_headers(
        response=response, request=request, total=total, limit=limit, offset=offset
    )
    # The sidebar badge counts what is waiting, not what this view shows.
    response.headers["X-Unreviewed-Total"] = str(await svc.count_unreviewed())
    return items


@router.get("/content/{content_id}", response_model=ReviewDetail)
async def review_detail(session: SessionDep, content_id: UUID) -> ReviewDetail:
    """One item in full for the reading pane, with the open reports against it."""
    return await ModerationService(session).detail(content_id)


@router.post(
    "/content/{content_id}/comments",
    response_model=ReviewCommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_review_comment(
    session: SessionDep,
    content_id: UUID,
    body: ReviewCommentCreate,
    background_tasks: BackgroundTasks,
    current_user: UserOut = ModeratorDep,
) -> ReviewCommentOut:
    """Leave a note on an item; `to_author` notes are emailed."""
    return await ModerationService(session).add_comment(
        content_id, current_user.id, body, background_tasks
    )


@router.get("/authors/{author_id}/standing", response_model=AuthorStanding)
async def author_standing(session: SessionDep, author_id: UUID) -> AuthorStanding:
    """Reports received, strikes and suspensions, kept as separate numbers."""
    mod = ModerationService(session)
    suspensions = PostingSuspensionService(session)
    return AuthorStanding(
        author_id=author_id,
        reports_received=await mod.reports_against_author(author_id),
        strikes=await mod.strikes_for_author(author_id),
        suspensions=await suspensions.history(author_id),
        active_suspension=await suspensions.active(author_id),
    )


@router.post(
    "/authors/{author_id}/suspensions",
    response_model=SuspensionOut,
    status_code=status.HTTP_201_CREATED,
)
async def suspend_author(
    session: SessionDep,
    author_id: UUID,
    body: SuspensionCreate,
    background_tasks: BackgroundTasks,
    current_user: UserOut = ModeratorDep,
) -> SuspensionOut:
    """Pause someone's submitting (skammarkrókur)."""
    return await PostingSuspensionService(session).suspend(
        author_id, current_user, body, background_tasks
    )


@router.patch("/suspensions/{suspension_id}/lift", response_model=SuspensionOut)
async def lift_suspension(
    session: SessionDep,
    suspension_id: UUID,
    body: SuspensionLift,
    current_user: UserOut = ModeratorDep,
) -> SuspensionOut:
    """End a suspension early; the record keeps that it was lifted."""
    return await PostingSuspensionService(session).lift(suspension_id, current_user, body)


@router.patch("/content/{content_id}/review", response_model=ReviewQueueItem)
async def review_content(
    session: SessionDep,
    content_id: UUID,
    body: ReviewDecision,
    background_tasks: BackgroundTasks,
    current_user: UserOut = ModeratorDep,
) -> ReviewQueueItem:
    """Approve, send back for changes, reject, or undo (`unreviewed`); the author is emailed
    when an item leaves the bank."""
    return await ModerationService(session).review(
        content_id, current_user.id, body, background_tasks
    )
