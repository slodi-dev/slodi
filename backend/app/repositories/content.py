from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.repositories.base import Repository


class ContentRepository(Repository):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_author_id(self, content_id: UUID) -> UUID | None:
        return await self.session.scalar(select(Content.author_id).where(Content.id == content_id))
