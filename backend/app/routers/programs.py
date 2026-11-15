# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    check_content_create,
    check_content_edit,
    check_content_read,
    check_workspace_access,
    get_current_user,
    is_content_moderator,
    require_not_suspended,
    strip_review_fields,
)
from app.core.db import get_session
from app.core.pagination import add_pagination_headers
from app.core.rate_limiter import user_rate_limit
from app.domain.enums import ContentType
from app.schemas.content import ContentListOut, ContentOut
from app.schemas.program import (
    BankQuery,
    ProgramCreate,
    ProgramOut,
    ProgramUpdate,
)
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceRole
from app.services.content import authored_by
from app.services.events import EventService
from app.services.programs import ProgramService
from app.services.tasks import TaskService

router = APIRouter(tags=["programs"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/workspaces/{workspace_id}/content", response_model=list[ContentListOut])
async def list_workspace_content(
    session: SessionDep,
    request: Request,
    response: Response,
    workspace_id: UUID,
    query: Annotated[BankQuery, Query()],
    current_user: UserOut = Depends(get_current_user),
) -> list[ContentListOut]:
    """Bank items of every kind."""
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = ProgramService(session)
    total = await svc.count_content_for_workspace(workspace_id, filters=query)
    items = await svc.list_content_for_workspace(
        workspace_id, current_user.id, limit=query.limit, offset=query.offset, filters=query
    )
    add_pagination_headers(
        response=response, request=request, total=total, limit=query.limit, offset=query.offset
    )
    return items


@router.post(
    "/workspaces/{workspace_id}/programs",
    response_model=ProgramOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_program_under_workspace(
    session: SessionDep,
    workspace_id: UUID,
    body: ProgramCreate,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
    _: None = Depends(user_rate_limit(20, 60)),
) -> ProgramOut:
    await check_content_create(workspace_id, current_user, session)
    program = await ProgramService(session).create_under_workspace(
        workspace_id, authored_by(body, current_user.id)
    )
    response.headers["Location"] = f"/content/{program.id}"
    return program


@router.get("/workspaces/{workspace_id}/content/facets", response_model=dict[str, list[str]])
async def list_workspace_content_facets(
    session: SessionDep,
    workspace_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> dict[str, list[str]]:
    """The values the filter sidebar can offer: locations, equipment, authors, tags."""
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = ProgramService(session)
    response.headers["Cache-Control"] = "private, max-age=300"
    return await svc.facets_for_workspace(workspace_id)


@router.get("/content/{content_id}", response_model=ContentOut)
async def get_content(
    session: SessionDep,
    content_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> ContentOut:
    """Read one bank item, whatever kind it is."""
    await check_content_read(content_id, current_user, session)

    svc = ProgramService(session)
    content_type = await svc.repo.get_content_type(content_id)
    if content_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    item: ContentOut
    if content_type == ContentType.program:
        item = await svc.get(
            content_id,
            current_user.id,
            include_hidden=True,
            include_hidden_children=is_content_moderator(current_user),
        )
    elif content_type == ContentType.event:
        item = await EventService(session).get(
            content_id,
            current_user.id,
            include_hidden=True,
            include_hidden_children=is_content_moderator(current_user),
        )
    else:
        item = await TaskService(session).get(content_id, current_user.id, include_hidden=True)

    # no-cache, not max-age: otherwise a new comment, like or edit seems to vanish on reload.
    response.headers["Cache-Control"] = "private, no-cache"
    return strip_review_fields(item, current_user)


@router.patch("/programs/{program_id}", response_model=ProgramOut)
async def update_program(
    session: SessionDep,
    program_id: UUID,
    body: ProgramUpdate,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
) -> ProgramOut:
    svc = ProgramService(session)
    await check_content_edit(program_id, current_user, session)
    return strip_review_fields(await svc.update(program_id, body, current_user.id), current_user)


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    session: SessionDep, program_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    svc = ProgramService(session)
    await check_content_edit(program_id, current_user, session, deleting=True)
    await svc.delete(program_id)
    return None
