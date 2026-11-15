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
        """The suspension in force right now, if any; asked on every write attempt."""
        stmt = (
            select(PostingSuspension)
            .options(
                selectinload(PostingSuspension.issued_by),
                selectinload(PostingSuspension.lifted_by),
            )
            .where(
                PostingSuspension.user_id == user_id,
                PostingSuspension.lifted_at.is_(None),
                PostingSuspension.starts_at <= now,
                # Null expiry is open-ended, not expired.
                (PostingSuspension.expires_at.is_(None)) | (PostingSuspension.expires_at > now),
            )
            # Nulls first: open-ended outlasts any dated one.
            .order_by(PostingSuspension.expires_at.desc().nullsfirst())
            .limit(1)
        )
        return await self.session.scalar(stmt)

    async def history_for(self, user_id: UUID) -> list[PostingSuspension]:
        """Every suspension, newest first."""
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
        """With who issued and lifted it; re-read after a change so both are current."""
        return await self.session.scalar(
            select(PostingSuspension)
            .options(
                selectinload(PostingSuspension.issued_by),
                selectinload(PostingSuspension.lifted_by),
            )
            .where(PostingSuspension.id == suspension_id)
            .execution_options(populate_existing=True)
        )
