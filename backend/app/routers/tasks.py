# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.content import ContentType
from app.models.workspace import WorkspaceRole
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.schemas.user import UserOut
from app.services.events import EventService
from app.services.tasks import TaskService

router = APIRouter(tags=["tasks"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# ----- collection under event -----


@router.get("/events/{event_id}/tasks", response_model=list[TaskOut])
async def list_event_tasks(
    session: SessionDep,
    request: Request,
    response: Response,
    event_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
):
    svc = TaskService(session)
    event_svc = EventService(session)
    event = await event_svc.get(event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    total = await svc.count_tasks_for_event(event_id)
    items = await svc.list_for_event(event_id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.post(
    "/events/{event_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_event_task(
    session: SessionDep,
    event_id: UUID,
    body: TaskCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
):
    assert body.content_type == ContentType.task, "Content type must be 'task'"
    svc = TaskService(session)
    event_svc = EventService(session)
    event = await event_svc.get(event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    task = await svc.create_under_event(event_id, body)
    response.headers["Location"] = f"/tasks/{task.id}"
    return task


# ----- item endpoints -----


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    session: SessionDep, task_id: UUID, current_user: UserOut = Depends(get_current_user)
):
    svc = TaskService(session)
    event_svc = EventService(session)
    task = await svc.get(task_id)
    event = await event_svc.get(task.event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    session: SessionDep,
    task_id: UUID,
    body: TaskUpdate,
    current_user: UserOut = Depends(get_current_user),
):
    svc = TaskService(session)
    event_svc = EventService(session)
    task = await svc.get(task_id)
    event = await event_svc.get(task.event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    return await svc.update(task_id, body)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    session: SessionDep, task_id: UUID, current_user: UserOut = Depends(get_current_user)
):
    svc = TaskService(session)
    event_svc = EventService(session)
    task = await svc.get(task_id)
    event = await event_svc.get(task.event_id)
    await check_workspace_access(
        event.workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    await svc.delete(task_id)
    return None
