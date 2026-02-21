from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.repositories.tags import TagRepository
from app.schemas.content import ContentOut
from app.schemas.tag import (
    ContentTagOut,
    TagCreate,
    TagOut,
    TagUpdate,
)


class TagService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TagRepository(session)

    # ----- tags -----

    async def count(self, *, q: str | None) -> int:
        return await self.repo.count(q=q)

    async def list(self, *, q: str | None, limit: int = 50, offset: int = 0) -> list[TagOut]:
        rows = await self.repo.list(q=q, limit=limit, offset=offset)
        return [TagOut.model_validate(r) for r in rows]

    async def get(self, tag_id: UUID) -> TagOut:
        row = await self.repo.get(tag_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
        return TagOut.model_validate(row)

    async def create(self, data: TagCreate) -> TagOut:
        tag = Tag(**data.model_dump())
        try:
            await self.repo.create(tag)
            await self.session.commit()
        except IntegrityError as e:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tag with this name already exists",
            ) from e
        await self.session.refresh(tag)
        return TagOut.model_validate(tag)

    async def update(self, tag_id: UUID, data: TagUpdate) -> TagOut:
        tag = await self.repo.get(tag_id)
        if not tag:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(tag, k, v)
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tag update violates constraints",
            ) from None
        await self.session.refresh(tag)
        return TagOut.model_validate(tag)

    async def delete(self, tag_id: UUID) -> None:
        tag = await self.repo.get(tag_id)
        if not tag:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
        await self.repo.delete(tag_id)
        await self.session.commit()

    # ----- associations -----

    async def count_content_tags(self, content_id: UUID) -> int:
        return await self.repo.count_content_tags(content_id)

    async def list_content_tags(
        self, content_id: UUID, *, limit: int = 100, offset: int = 0
    ) -> list[TagOut]:  # type: ignore[valid-type]
        rows = await self.repo.list_content_tags(content_id, limit=limit, offset=offset)
        return [TagOut.model_validate(r) for r in rows]

    async def count_tagged_content(self, tag_id: UUID) -> int:
        return await self.repo.count_tagged_content(tag_id)

    async def list_tagged_content(
        self, tag_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[ContentOut]:  # type: ignore[valid-type]
        rows = await self.repo.list_tagged_content(tag_id, limit=limit, offset=offset)
        return [ContentOut.model_validate(r) for r in rows]

    async def add_content_tag(self, content_id: UUID, tag_id: UUID) -> tuple[bool, ContentTagOut]:
        try:
            created, ct = await self.repo.add_content_tag(content_id, tag_id)
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tag is already attached to this content",
            ) from None
        return created, ContentTagOut.model_validate(ct)

    async def remove_content_tag(self, content_id: UUID, tag_id: UUID) -> None:
        deleted = await self.repo.remove_content_tag(content_id, tag_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tag not attached to content",
            )
        await self.session.commit()
