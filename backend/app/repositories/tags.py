from __future__ import annotations

import datetime as dt
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.tag import ContentTag, Tag
from app.repositories.base import Repository


class TagRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    # ----- tags -----

    async def get(self, tag_id: UUID) -> Tag | None:
        stmt: Select[tuple[Tag]] = (
            select(Tag)
            .options(selectinload(Tag.content_tags))
            .where(Tag.id == tag_id, Tag.deleted_at.is_(None))
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_by_name(self, name: str) -> Tag | None:
        stmt = select(Tag).where(Tag.name == name, Tag.deleted_at.is_(None))
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def count(self, *, q: str | None = None) -> int:
        stmt = select(func.count()).select_from(Tag).where(Tag.deleted_at.is_(None))
        if q:
            ilike = f"%{q.strip()}%"
            stmt = stmt.where(Tag.name.ilike(ilike))
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def list(
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
        return res.rowcount or 0

    # ----- associations -----

    async def count_content_tags(self, content_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count()).select_from(ContentTag).where(ContentTag.content_id == content_id)
        )
        return result or 0

    async def list_content_tags(
        self, content_id: UUID, *, limit: int = 100, offset: int = 0
    ) -> Sequence[Tag]:
        stmt = (
            select(Tag)
            .join(ContentTag, ContentTag.tag_id == Tag.id)
            .where(ContentTag.content_id == content_id, Tag.deleted_at.is_(None))
            .order_by(Tag.name)
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def count_tagged_content(self, tag_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(ContentTag)
            .join(Content, Content.id == ContentTag.content_id)
            .where(ContentTag.tag_id == tag_id, Content.deleted_at.is_(None))
        )
        return result or 0

    async def list_tagged_content(
        self, tag_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[Content]:
        stmt = (
            select(Content)
            .join(ContentTag, ContentTag.content_id == Content.id)
            .where(ContentTag.tag_id == tag_id, Content.deleted_at.is_(None))
            .order_by(Content.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return await self.scalars(stmt)

    async def get_content_tag(self, content_id: UUID, tag_id: UUID) -> ContentTag | None:
        return await self.session.scalar(
            select(ContentTag).where(
                and_(ContentTag.content_id == content_id, ContentTag.tag_id == tag_id)
            )
        )

    async def add_content_tag(self, content_id: UUID, tag_id: UUID) -> tuple[bool, ContentTag]:
        existing = await self.get_content_tag(content_id, tag_id)
        if existing:
            return False, existing
        ct = ContentTag(content_id=content_id, tag_id=tag_id)
        await self.add(ct)
        return True, ct

    async def remove_content_tag(self, content_id: UUID, tag_id: UUID) -> int:
        res = await self.session.execute(
            delete(ContentTag).where(
                and_(ContentTag.content_id == content_id, ContentTag.tag_id == tag_id)
            )
        )
        return res.rowcount or 0
