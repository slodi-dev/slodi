from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.task import Task
from app.repositories.tasks import TaskRepository
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.content import requeue_if_author_fixed, set_tags
from app.services.uploads import AttachmentVerifier


class TaskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TaskRepository(session)

    async def create_under_workspace(self, workspace_id: UUID, data: TaskCreate) -> TaskOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        task = Task(workspace_id=workspace_id, **data.model_dump(exclude={"tag_names"}))
        await self.repo.create(task)
        await self.session.flush()
        if data.tag_names:
            await set_tags(self.session, task.id, data.tag_names)
        await self.session.commit()
        return await self.get(task.id)

    async def get(
        self, task_id: UUID, current_user_id: UUID | None = None, *, include_hidden: bool = False
    ) -> TaskOut:
        row = await self.repo.get(task_id, current_user_id, include_hidden=include_hidden)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return TaskOut.from_row(*row)

    async def update(
        self, task_id: UUID, data: TaskUpdate, current_user_id: UUID | None = None
    ) -> TaskOut:
        await AttachmentVerifier().check_content(data.image, data.media)
        row = await self.repo.get(task_id, include_hidden=True)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        task, _ = row
        if data.event_id is not None:
            # Selecting from Event matches events only, not any content id.
            event_workspace_id = await self.session.scalar(
                select(Event.workspace_id).where(
                    Event.id == data.event_id, Event.deleted_at.is_(None)
                )
            )
            if event_workspace_id is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
            if event_workspace_id != task.workspace_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Event does not belong to the same workspace as the task",
                )
        for k, v in data.model_dump(exclude_unset=True, exclude={"tag_names"}).items():
            setattr(task, k, v)
        requeue_if_author_fixed(task, current_user_id)
        if "tag_names" in data.model_fields_set:
            await set_tags(self.session, task_id, data.tag_names or [])
        await self.session.commit()
        return await self.get(task_id, current_user_id, include_hidden=True)

    async def delete(self, task_id: UUID) -> None:
        # Looked up as a Task first: the soft delete matches any content id.
        if not await self.repo.get(task_id, include_hidden=True):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        await self.repo.delete(task_id)
        await self.session.commit()
