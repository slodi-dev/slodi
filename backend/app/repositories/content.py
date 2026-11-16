from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import delete, false, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.domain.enums import ContentType, ReviewState
from app.models.comment import Comment
from app.models.content import Content
from app.models.event import Event
from app.models.like import UserLikedContent
from app.models.placement import Placement
from app.models.tag import ContentTag
from app.models.task import Task
from app.repositories.base import Repository
from app.utils import get_current_datetime


@dataclass
class ContentAccess:
    """What an access check needs about an item, in one query."""

    workspace_id: UUID
    author_id: UUID
    hidden_at: dt.datetime | None
    review_state: ReviewState = ReviewState.unreviewed


@dataclass
class ContentStats:
    like_count: int
    comment_count: int
    liked_by_me: bool
    times_used: int = 0


def listable(model: Any, *, include_hidden: bool = False) -> Any:
    """
    The conditions every listing of bank content has to carry.

    Deleted is obvious. **Hidden is the one that kept getting missed:** it was
    enforced in the polymorphic bank listing and in the three `get()` methods,
    and absent from all eight type-specific list and count methods, so a hidden
    item stayed enumerable through `GET /workspaces/{id}/tasks` and its
    siblings. Hiding is the moderators' one-click response to content that
    should not be in front of a volunteer audience; a removal that only holds on
    one of five read paths is not a removal.

    Take this rather than writing the pair by hand, so "list content" cannot be
    written without answering both.

    `include_hidden=True` keeps hidden items and still drops deleted ones. It is
    for Dagskrárstjórnarteymið only: decide it with `is_content_moderator()` at
    the route, never from anything the caller sends. The response then carries
    `hidden_at` so the frontend can mark those items instead of presenting them
    as live.
    """
    if include_hidden:
        return model.deleted_at.is_(None)
    return (model.deleted_at.is_(None)) & (model.hidden_at.is_(None))


def like_count_subq() -> Any:
    """Correlated subquery: COUNT of likes for the current Content row."""
    return (
        select(func.count())
        .select_from(UserLikedContent)
        .where(UserLikedContent.content_id == Content.id)
        .correlate(Content)
        .scalar_subquery()
    )


def comment_count_subq() -> Any:
    """Correlated subquery: COUNT of non-deleted comments for the current Content row."""
    return (
        select(func.count())
        .select_from(Comment)
        .where(Comment.content_id == Content.id, Comment.deleted_at.is_(None))
        .correlate(Content)
        .scalar_subquery()
    )


def times_used_subq() -> Any:
    """Correlated subquery: placements of the current Content row plus copies made from it."""
    copy = aliased(Content)
    placements = (
        select(func.count())
        .select_from(Placement)
        .where(Placement.content_id == Content.id)
        .correlate(Content)
        .scalar_subquery()
    )
    copies = (
        select(func.count())
        .select_from(copy)
        .where(copy.copied_from_id == Content.id, copy.deleted_at.is_(None))
        .correlate(Content)
        .scalar_subquery()
    )
    return placements + copies


def liked_by_me_subq(current_user_id: UUID | None) -> Any:
    """Correlated EXISTS subquery: True if current_user has liked the row."""
    if current_user_id is None:
        return false()
    return (
        select(UserLikedContent.user_id)
        .where(
            UserLikedContent.content_id == Content.id,
            UserLikedContent.user_id == current_user_id,
        )
        .correlate(Content)
        .exists()
    )


class ContentRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_name(self, content_id: UUID) -> str | None:
        return await self.session.scalar(select(Content.name).where(Content.id == content_id))

    async def get_with_stats(
        self, content_id: UUID, current_user_id: UUID | None = None, *, include_hidden: bool = False
    ) -> tuple[Content, ContentStats] | None:
        stmt = (
            select(
                Content,
                like_count_subq(),
                comment_count_subq(),
                liked_by_me_subq(current_user_id),
                times_used_subq(),
            )
            .options(
                selectinload(Content.author),
                selectinload(Content.workspace),
                selectinload(Content.comments.and_(Comment.deleted_at.is_(None))).selectinload(
                    Comment.user
                ),
                selectinload(Content.content_tags).selectinload(ContentTag.tag),
            )
            .where(Content.id == content_id, Content.deleted_at.is_(None))
            .execution_options(populate_existing=True)
        )
        if not include_hidden:
            stmt = stmt.where(Content.hidden_at.is_(None))
        row = (await self.session.execute(stmt)).first()
        if row is None:
            return None
        item, lc, cc, lm, tu = row
        return item, ContentStats(
            like_count=int(lc), comment_count=int(cc), liked_by_me=bool(lm), times_used=int(tu)
        )

    async def soft_delete(self, item: Content) -> None:
        await self.session.execute(delete(Placement).where(Placement.content_id == item.id))
        # Until the old model goes: what it held stays in the workspace, unattached.
        if item.content_type == ContentType.program:
            await self.session.execute(
                update(Event).where(Event.program_id == item.id).values(program_id=None)
            )
        elif item.content_type == ContentType.event:
            await self.session.execute(
                update(Task).where(Task.event_id == item.id).values(event_id=None)
            )
        item.deleted_at = get_current_datetime()

    async def get_access(self, content_id: UUID) -> ContentAccess | None:
        """Who owns it, where it lives, and whether it has been unlisted.

        Filters `deleted_at` — the single-column getters above do not, which is
        how commenting on a withdrawn item stayed possible.
        """
        row = (
            await self.session.execute(
                select(
                    Content.workspace_id, Content.author_id, Content.hidden_at, Content.review_state
                ).where(Content.id == content_id, Content.deleted_at.is_(None))
            )
        ).first()
        return ContentAccess(row[0], row[1], row[2], row[3]) if row else None
