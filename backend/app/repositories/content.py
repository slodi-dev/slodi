from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import false, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.content import Content
from app.models.like import UserLikedContent
from app.repositories.base import Repository


@dataclass
class ContentAccess:
    """The three facts an access check needs about an item, in one query."""

    workspace_id: UUID
    author_id: UUID
    hidden_at: dt.datetime | None


@dataclass
class ContentStats:
    like_count: int
    comment_count: int
    liked_by_me: bool


def listable(model: Any) -> Any:
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
    """
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

    async def get_author_id(self, content_id: UUID) -> UUID | None:
        return await self.session.scalar(select(Content.author_id).where(Content.id == content_id))

    async def get_workspace_id(self, content_id: UUID) -> UUID | None:
        return await self.session.scalar(
            select(Content.workspace_id).where(Content.id == content_id)
        )

    async def get_name(self, content_id: UUID) -> str | None:
        return await self.session.scalar(select(Content.name).where(Content.id == content_id))

    async def get_access(self, content_id: UUID) -> ContentAccess | None:
        """Who owns it, where it lives, and whether it has been unlisted.

        Filters `deleted_at` — the single-column getters above do not, which is
        how commenting on a withdrawn item stayed possible.
        """
        row = (
            await self.session.execute(
                select(Content.workspace_id, Content.author_id, Content.hidden_at).where(
                    Content.id == content_id, Content.deleted_at.is_(None)
                )
            )
        ).first()
        return ContentAccess(row[0], row[1], row[2]) if row else None
