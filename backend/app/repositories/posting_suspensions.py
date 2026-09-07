from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.posting_suspension import PostingSuspension

from .base import Repository


class PostingSuspensionRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def active_for(self, user_id: UUID, now: dt.datetime) -> PostingSuspension | None:
        """The suspension in force right now, if any.

        Asked on every write attempt, which is why `(user_id, expires_at)` is
        indexed and why this returns at most one row rather than a history.
        """
        stmt = (
            select(PostingSuspension)
            .where(
                PostingSuspension.user_id == user_id,
                PostingSuspension.lifted_at.is_(None),
                PostingSuspension.starts_at <= now,
                PostingSuspension.expires_at > now,
            )
            .order_by(PostingSuspension.expires_at.desc())
            .limit(1)
        )
        return await self.session.scalar(stmt)

    async def history_for(self, user_id: UUID) -> list[PostingSuspension]:
        """Every spell, newest first. "Third time this year" is the point."""
        stmt = (
            select(PostingSuspension)
            .options(
                selectinload(PostingSuspension.issued_by),
                selectinload(PostingSuspension.lifted_by),
            )
            .where(PostingSuspension.user_id == user_id)
            .order_by(PostingSuspension.starts_at.desc())
        )
        return list(await self.session.scalars(stmt))

    async def get(self, suspension_id: UUID) -> PostingSuspension | None:
        return await self.session.scalar(
            select(PostingSuspension).where(PostingSuspension.id == suspension_id)
        )
