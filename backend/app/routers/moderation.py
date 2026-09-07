# ruff: noqa: B008
from __future__ import annotations

import datetime as dt
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.domain.enums import ContentType, Permissions, ReviewState
from app.schemas.moderation import (
    HideDecision,
    ReviewCommentCreate,
    ReviewCommentOut,
    ReviewDecision,
    ReviewDetail,
    ReviewFilters,
    ReviewQueueItem,
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

router = APIRouter(prefix="/moderation", tags=["moderation"])

ALL_STATES = "all"
"""The audit view — every state at once."""
SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Dagskrárstjórnarteymið. Admins outrank moderators, so they pass this for free.
ModeratorDep = Depends(require_permission(Permissions.moderator))


@router.get("/queue", response_model=list[ReviewQueueItem])
async def review_queue(
    session: SessionDep,
    request: Request,
    response: Response,
    current_user: UserOut = ModeratorDep,
    review_state: str = Query(
        ReviewState.unreviewed.value,
        description="A ReviewState, or 'all' for every state — the audit view.",
    ),
    hidden: bool | None = Query(None),
    content_type: ContentType | None = Query(None),
    reported: bool | None = Query(None, description="Only things somebody objected to."),
    search: str | None = Query(None, max_length=200, description="Substring of the name."),
    author: str | None = Query(None, max_length=200, description="Substring of the author's name."),
    date_from: dt.date | None = Query(None),
    date_to: dt.date | None = Query(None),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[ReviewQueueItem]:
    """The board's list.

    Defaults to **Óyfirfarið**, which is the working view. The other states are
    the record of what was done: filter to `approved` to answer "who approved
    this, and when?" without reaching for the database.

    The unreviewed queue runs oldest-first because it is a backlog; every other
    view runs most-recently-decided first, which is how "what happened lately?"
    is asked.
    """
    # "all" rather than an empty value: `review_state=` in a URL is ambiguous
    # between "every state" and "the caller forgot", and FastAPI cannot coerce
    # an empty string into the enum anyway — it answered 422.
    if review_state == ALL_STATES:
        state = None
    else:
        try:
            state = ReviewState(review_state)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"Unknown review_state '{review_state}'. Use one of "
                    f"{', '.join(s.value for s in ReviewState)} or '{ALL_STATES}'."
                ),
            ) from exc

    filters = ReviewFilters(
        review_state=state,
        hidden=hidden,
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
    # The sidebar badge counts what is waiting, not what this view happens to show.
    response.headers["X-Unreviewed-Total"] = str(await svc.count_unreviewed())
    return items


@router.get("/content/{content_id}", response_model=ReviewDetail)
async def review_detail(
    session: SessionDep,
    content_id: UUID,
    current_user: UserOut = ModeratorDep,
) -> ReviewDetail:
    """One item in full, for the reading pane — including the objections
    against it, so a flagged item can be judged from one screen."""
    return await ModerationService(session).detail(content_id)


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
    """Leave a note on an item.

    `internal` stays between the team. `to_author` is emailed to whoever wrote
    the thing, because a suggestion nobody is told about is not a suggestion.
    There is no default: which of the two it is has to be chosen every time.
    """
    return await ModerationService(session).add_comment(
        content_id, current_user.id, body, background_tasks
    )


@router.get("/authors/{author_id}/standing", response_model=AuthorStanding)
async def author_standing(
    session: SessionDep,
    author_id: UUID,
    current_user: UserOut = ModeratorDep,
) -> AuthorStanding:
    """What a reviewer needs to know about a person before deciding.

    Three separate numbers on purpose. Reports received is context — anyone can
    be reported, and a raw count is gameable. Strikes are decisions a moderator
    actually made. Suspensions are what was done about them. One combined "trust
    score" would hide the difference between being complained about and being
    wrong.
    """
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
    """Put someone in skammarkrókur — a timed pause on submitting.

    They keep reading, filtering, favourites, likes, and **reporting**: taking
    away someone's ability to flag genuinely unsafe content because they are
    themselves under review helps nobody.

    A moderator may suspend for up to 90 days; longer is an admin's call.
    """
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
    """End one early. The record keeps both facts — a suspension that was
    reconsidered is not the same as one that ran its course."""
    return await PostingSuspensionService(session).lift(suspension_id, current_user, body)


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
