from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import ContentTag, Tag
from app.repositories.base import Repository


class TagRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, tag_id: UUID) -> Tag | None:
        return await self.session.scalar(
            select(Tag).where(Tag.id == tag_id, Tag.deleted_at.is_(None))
        )

    async def count(self, *, q: str | None = None) -> int:
        stmt = select(func.count()).select_from(Tag).where(Tag.deleted_at.is_(None))
        if q:
            ilike = f"%{q.strip()}%"
            stmt = stmt.where(Tag.name.ilike(ilike))
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def list_all(
        self, *, q: str | None = None, limit: int = 50, offset: int = 0
    ) -> Sequence[Tag]:
        stmt = select(Tag).where(Tag.deleted_at.is_(None)).order_by(Tag.name)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(Tag.name.ilike(like))
        stmt = stmt.limit(limit).offset(offset)
        return await self.scalars(stmt)

    async def create(self, tag: Tag) -> Tag:
        await self.add(tag)
        return tag

    async def delete(self, tag_id: UUID) -> int:
        now = dt.datetime.now(dt.timezone.utc)
        res = await self.session.execute(
            update(Tag).where(Tag.id == tag_id, Tag.deleted_at.is_(None)).values(deleted_at=now)
        )
        assert isinstance(res, CursorResult)
        deleted = res.rowcount or 0
        if deleted:
            # The tag row stays (soft delete) but nothing should carry it any
            # more: otherwise it lingers on items, in facets and in filters.
            await self.session.execute(delete(ContentTag).where(ContentTag.tag_id == tag_id))
        return deleted

    # ----- associations -----

    async def set_content_tags_by_names(
        self, content_id: UUID, names: Sequence[str]
    ) -> Sequence[str]:
        """Replace all tags for content_id. Returns any names not found."""
        wanted = list(dict.fromkeys(names))  # drop repeats, keep order
        found = {
            tag.name: tag.id
            for tag in await self.scalars(
                select(Tag).where(Tag.name.in_(wanted), Tag.deleted_at.is_(None))
            )
        }
        await self.session.execute(delete(ContentTag).where(ContentTag.content_id == content_id))
        self.session.add_all(
            ContentTag(content_id=content_id, tag_id=found[name])
            for name in wanted
            if name in found
        )
        return [name for name in wanted if name not in found]
