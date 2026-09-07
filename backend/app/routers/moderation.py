# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.domain.enums import Permissions
from app.schemas.moderation import HideDecision, ReviewDecision, ReviewQueueItem
from app.schemas.user import UserOut
from app.services.moderation import ModerationService

router = APIRouter(prefix="/moderation", tags=["moderation"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Dagskrárstjórnarteymið. Admins outrank moderators, so they pass this for free.
ModeratorDep = Depends(require_permission(Permissions.moderator))


@router.get("/queue", response_model=list[ReviewQueueItem])
async def review_queue(
    session: SessionDep,
    request: Request,
    response: Response,
    current_user: UserOut = ModeratorDep,
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[ReviewQueueItem]:
    """Óyfirfarið — everything the team has not looked at, oldest first.

    Oldest first because this is a backlog, not a feed: newest-first would let
    old submissions sink forever under a trickle of new ones.
    """
    svc = ModerationService(session)
    total = await svc.count_unreviewed()
    items = await svc.queue(limit=limit, offset=offset)
    add_pagination_headers(
        response=response, request=request, total=total, limit=limit, offset=offset
    )
    return items


@router.get("/authors/{author_id}/strikes")
async def author_strikes(
    session: SessionDep,
    author_id: UUID,
    current_user: UserOut = ModeratorDep,
) -> dict[str, int]:
    """How much of this author's work a moderator has acted against.

    Derived from the content itself, never a stored counter — un-hiding
    something takes its strike with it, which a counter would not do.
    """
    return {"strikes": await ModerationService(session).strikes_for_author(author_id)}


@router.patch("/content/{content_id}/review", response_model=ReviewQueueItem)
async def review_content(
    session: SessionDep,
    content_id: UUID,
    body: ReviewDecision,
    current_user: UserOut = ModeratorDep,
) -> ReviewQueueItem:
    """Approve or reject. Does **not** change what anyone can see — hiding does."""
    return await ModerationService(session).review(content_id, current_user.id, body)


@router.patch("/content/{content_id}/hidden", response_model=ReviewQueueItem)
async def set_content_hidden(
    session: SessionDep,
    content_id: UUID,
    body: HideDecision,
    current_user: UserOut = ModeratorDep,
) -> ReviewQueueItem:
    """Take something out of the bank, or put it back."""
    return await ModerationService(session).set_hidden(content_id, current_user.id, body)
