from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.repositories.tags import TagRepository
from app.schemas.tag import TagCreate, TagOut, TagUpdate


class TagService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TagRepository(session)

    async def count(self, *, q: str | None) -> int:
        return await self.repo.count(q=q)

    async def list_all(self, *, q: str | None, limit: int = 50, offset: int = 0) -> list[TagOut]:
        rows = await self.repo.list_all(q=q, limit=limit, offset=offset)
        return [TagOut.model_validate(r) for r in rows]

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
