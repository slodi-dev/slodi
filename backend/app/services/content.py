from __future__ import annotations

from collections.abc import Sequence
from typing import TypeVar
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ContentLevel, ReviewState
from app.models.content import Content
from app.models.event import Event
from app.models.program import Program
from app.models.season import Season
from app.models.task import Task
from app.repositories.content import ContentRepository
from app.repositories.tags import TagRepository
from app.schemas.content import ContentCreate, ContentCreateAtLevel, ContentOut, ContentUpdate
from app.services.uploads import AttachmentVerifier
from app.utils import get_current_datetime

CreateT = TypeVar("CreateT", bound=ContentCreate)


def authored_by(body: CreateT, user_id: UUID) -> CreateT:
    """The author and creation time are the server's to set, never the client's."""
    return body.model_copy(update={"author_id": user_id, "created_at": get_current_datetime()})


async def set_tags(session: AsyncSession, content_id: UUID, names: Sequence[str]) -> None:
    not_found = await TagRepository(session).set_content_tags_by_names(content_id, names)
    if not_found:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown tags: {not_found}"
        )


def requeue_if_author_fixed(item: Content, editor_id: UUID | None) -> None:
    """An item sent back for changes returns to the bank and the queue once its author edits it."""
    if item.review_state == ReviewState.needs_changes and item.author_id == editor_id:
        item.review_state = ReviewState.unreviewed
        item.hidden_at = None


_MODEL_OF_LEVEL: dict[ContentLevel, type[Content]] = {
    ContentLevel.task: Task,
    ContentLevel.event: Event,
    ContentLevel.program: Program,
    ContentLevel.season: Season,
}


class ContentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ContentRepository(session)

    async def create(self, workspace_id: UUID, data: ContentCreateAtLevel) -> ContentOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        model = _MODEL_OF_LEVEL[ContentLevel(data.level)]
        item = model(workspace_id=workspace_id, **data.model_dump(exclude={"tag_names", "level"}))
        self.session.add(item)
        await self.session.flush()
        if data.tag_names:
            await set_tags(self.session, item.id, data.tag_names)
        await self.session.commit()
        return await self.get(item.id, data.author_id, include_hidden=True)

    async def get(
        self, content_id: UUID, current_user_id: UUID | None = None, *, include_hidden: bool = False
    ) -> ContentOut:
        row = await self.repo.get_with_stats(
            content_id, current_user_id, include_hidden=include_hidden
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        return ContentOut.from_row(*row)

    async def update(
        self, content_id: UUID, data: ContentUpdate, current_user_id: UUID | None = None
    ) -> ContentOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        item = await self._get_row(content_id)
        for k, v in data.model_dump(exclude_unset=True, exclude={"tag_names"}).items():
            setattr(item, k, v)
        requeue_if_author_fixed(item, current_user_id)
        if "tag_names" in data.model_fields_set:
            await set_tags(self.session, content_id, data.tag_names or [])
        await self.session.commit()
        return await self.get(content_id, current_user_id, include_hidden=True)

    async def delete(self, content_id: UUID) -> None:
        await self.repo.soft_delete(await self._get_row(content_id))
        await self.session.commit()

    async def _get_row(self, content_id: UUID) -> Content:
        row = await self.repo.get_with_stats(content_id, include_hidden=True)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        return row[0]

    async def get_name(self, content_id: UUID) -> str:
        """The item's name, for an escalation email that has to say what it is about."""
        name = await self.repo.get_name(content_id)
        if name is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
        return name
