from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.task import Task
from app.repositories.tags import TagRepository
from app.repositories.tasks import TaskRepository
from app.schemas.task import TaskCreate, TaskListOut, TaskOut, TaskUpdate


class TaskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TaskRepository(session)

    async def count_tasks_for_event(self, event_id: UUID) -> int:
        return await self.repo.count_tasks_for_event(event_id)

    async def list_for_event(
        self,
        event_id: UUID,
        current_user_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TaskListOut]:
        rows = await self.repo.list_for_event(event_id, current_user_id, limit=limit, offset=offset)
        return [TaskListOut.from_row(task, stats) for task, stats in rows]

    async def count_for_workspace(self, workspace_id: UUID) -> int:
        return await self.repo.count_for_workspace(workspace_id)

    async def list_for_workspace(
        self,
        workspace_id: UUID,
        current_user_id: UUID | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TaskListOut]:
        rows = await self.repo.list_for_workspace(
            workspace_id, current_user_id, limit=limit, offset=offset
        )
        return [TaskListOut.from_row(task, stats) for task, stats in rows]

    async def create_under_event(self, event_id: UUID, data: TaskCreate) -> TaskOut:
        workspace_id = await self.session.scalar(
            select(Content.workspace_id).where(Content.id == event_id, Content.deleted_at.is_(None))
        )
        if workspace_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        tag_names = data.tag_names or []
        task = Task(
            event_id=event_id, workspace_id=workspace_id, **data.model_dump(exclude={"tag_names"})
        )
        await self.repo.create(task)
        await self.session.flush()
        if tag_names:
            tag_repo = TagRepository(self.session)
            not_found = await tag_repo.add_content_tags_by_names(task.id, tag_names)
            if not_found:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unknown tags: {not_found}",
                )
        await self.session.commit()
        fetched = await self.repo.get(task.id)
        if not fetched:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created task",
            )
        t, stats = fetched
        return TaskOut.from_row(t, stats)

    async def create_under_workspace(self, workspace_id: UUID, data: TaskCreate) -> TaskOut:
        tag_names = data.tag_names or []
        task = Task(
            workspace_id=workspace_id, event_id=None, **data.model_dump(exclude={"tag_names"})
        )
        await self.repo.create(task)
        await self.session.flush()
        if tag_names:
            tag_repo = TagRepository(self.session)
            not_found = await tag_repo.add_content_tags_by_names(task.id, tag_names)
            if not_found:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unknown tags: {not_found}",
                )
        await self.session.commit()
        fetched = await self.repo.get(task.id)
        if not fetched:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created task",
            )
        t, stats = fetched
        return TaskOut.from_row(t, stats)

    async def get(self, task_id: UUID, current_user_id: UUID | None = None) -> TaskOut:
        row = await self.repo.get(task_id, current_user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        task, stats = row
        return TaskOut.from_row(task, stats)

    async def get_in_event(
        self, task_id: UUID, event_id: UUID, current_user_id: UUID | None = None
    ) -> TaskOut:
        row = await self.repo.get_in_event(task_id, event_id, current_user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        task, stats = row
        return TaskOut.from_row(task, stats)

    async def update(
        self, task_id: UUID, data: TaskUpdate, current_user_id: UUID | None = None
    ) -> TaskOut:
        row = await self.repo.get(task_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        task, _ = row
        patch = data.model_dump(exclude_unset=True, exclude={"tag_names"})
        if "event_id" in patch and patch["event_id"] is not None:
            event_workspace_id = await self.session.scalar(
                select(Content.workspace_id).where(
                    Content.id == patch["event_id"],
                    Content.deleted_at.is_(None),
                )
            )
            if event_workspace_id is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
            if event_workspace_id != task.workspace_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Event does not belong to the same workspace as the task",
                )
        for k, v in patch.items():
            setattr(task, k, v)
        if "tag_names" in data.model_fields_set:
            tag_repo = TagRepository(self.session)
            not_found = await tag_repo.set_content_tags_by_names(task_id, data.tag_names or [])
            if not_found:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unknown tags: {not_found}",
                )
        await self.session.commit()
        updated = await self.repo.get(task_id, current_user_id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated task",
            )
        t, stats = updated
        return TaskOut.from_row(t, stats)

    async def delete(self, task_id: UUID) -> None:
        deleted = await self.repo.delete(task_id)
        if deleted == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        await self.session.commit()
