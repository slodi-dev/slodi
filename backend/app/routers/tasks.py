# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    check_content_create,
    check_content_edit,
    get_current_user,
    require_not_suspended,
    strip_review_fields,
)
from app.core.db import get_session
from app.core.rate_limiter import user_rate_limit
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.schemas.user import UserOut
from app.services.content import authored_by
from app.services.tasks import TaskService

router = APIRouter(tags=["tasks"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post(
    "/workspaces/{workspace_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace_task(
    session: SessionDep,
    workspace_id: UUID,
    body: TaskCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
    _: None = Depends(user_rate_limit(20, 60)),
) -> TaskOut:
    await check_content_create(workspace_id, current_user, session, hide_from_non_members=True)
    task = await TaskService(session).create_under_workspace(
        workspace_id, authored_by(body, current_user.id)
    )
    response.headers["Location"] = f"/content/{task.id}"
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    session: SessionDep,
    task_id: UUID,
    body: TaskUpdate,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
) -> TaskOut:
    await check_content_edit(task_id, current_user, session, attaching=body.event_id is not None)
    task = await TaskService(session).update(task_id, body, current_user.id)
    return strip_review_fields(task, current_user)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    session: SessionDep, task_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    await check_content_edit(task_id, current_user, session, deleting=True)
    await TaskService(session).delete(task_id)
