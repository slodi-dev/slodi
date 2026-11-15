from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ReviewState
from app.models.content import Content
from app.repositories.content import ContentRepository


def requeue_if_author_fixed(item: Content, editor_id: UUID | None) -> None:
    """An item sent back for changes returns to the bank and the queue once its author edits it."""
    if item.review_state == ReviewState.needs_changes and item.author_id == editor_id:
        item.review_state = ReviewState.unreviewed
        item.hidden_at = None


class ContentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ContentRepository(session)

    async def get_name(self, content_id: UUID) -> str:
        """The item's name, for an escalation email that has to say what it is about."""
        name = await self.repo.get_name(content_id)
        if name is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        return name
