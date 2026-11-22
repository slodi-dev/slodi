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
from app.schemas.event import EventCreate, EventOut, EventUpdate
from app.schemas.user import UserOut
from app.services.content import authored_by
from app.services.events import EventService

router = APIRouter(tags=["events"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post(
    "/workspaces/{workspace_id}/events",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace_event(
    session: SessionDep,
    workspace_id: UUID,
    body: EventCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
    _: None = Depends(user_rate_limit(20, 60)),
) -> EventOut:
    await check_content_create(workspace_id, current_user, session)
    event = await EventService(session).create_under_workspace(
        workspace_id, authored_by(body, current_user.id)
    )
    response.headers["Location"] = f"/content/{event.id}"
    return event


@router.patch("/events/{event_id}", response_model=EventOut)
async def update_event(
    session: SessionDep,
    event_id: UUID,
    body: EventUpdate,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
) -> EventOut:
    await check_content_edit(event_id, current_user, session, attaching=body.program_id is not None)
    event = await EventService(session).update(event_id, body, current_user.id)
    return strip_review_fields(event, current_user)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    session: SessionDep, event_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    await check_content_edit(event_id, current_user, session, deleting=True)
    await EventService(session).delete(event_id)
