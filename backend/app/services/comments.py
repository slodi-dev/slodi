from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.repositories.comments import CommentRepository
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate


class CommentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CommentRepository(session)

    async def count_content_comments(self, content_id: UUID) -> int:
        return await self.repo.count_content_comments(content_id)

    async def list_for_content(
        self, content_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[CommentOut]:
        rows = await self.repo.list_for_content(content_id, limit=limit, offset=offset)
        return [CommentOut.model_validate(r) for r in rows]

    async def create_under_content(self, content_id: UUID, data: CommentCreate) -> CommentOut:
        comment = Comment(
            body=data.body,
            content_id=content_id,
            user_id=data.user_id,
            created_at=data.created_at,
        )
        await self.repo.create(comment)
        await self.session.commit()
        # Re-read through the repository rather than `refresh`: `CommentOut`
        # carries `author_name`, which reads `comment.user.name`, and a plain
        # refresh does not populate relationships — serialising the bare object
        # would lazy-load under async and raise MissingGreenlet.
        row = await self.repo.get(comment.id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Comment vanished after commit",
            )
        return CommentOut.model_validate(row)

    async def get(self, comment_id: UUID) -> CommentOut:
        row = await self.repo.get(comment_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        return CommentOut.model_validate(row)

    async def update(self, comment_id: UUID, data: CommentUpdate) -> CommentOut:
        row = await self.repo.get(comment_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        patch = data.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(row, k, v)
        await self.session.commit()
        await self.session.refresh(row)
        return CommentOut.model_validate(row)

    async def delete(self, comment_id: UUID) -> None:
        deleted = await self.repo.delete(comment_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        await self.session.commit()
