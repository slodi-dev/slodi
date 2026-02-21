# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_program_edit_access, check_workspace_access, get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.content import ContentType
from app.schemas.program import ProgramCreate, ProgramOut, ProgramUpdate
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceRole
from app.services.programs import ProgramService

router = APIRouter(tags=["programs"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

# ----- workspace-scoped collection endpoints -----


@router.get("/workspaces/{workspace_id}/programs", response_model=list[ProgramOut])
async def list_workspace_programs(
    session: SessionDep,
    request: Request,
    response: Response,
    workspace_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
) -> list[ProgramOut]:
    svc = ProgramService(session)
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    total = await svc.count_programs_for_workspace(workspace_id)
    items = await svc.list_for_workspace(workspace_id, current_user.id, limit=limit, offset=offset)
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
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
) -> ProgramOut:
    assert body.content_type == ContentType.program, "Content type must be 'program'"
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    program_data = body.model_copy(
        update={
            "author_id": current_user.id,
            "like_count": 0,
            "created_at": get_current_datetime(),
        }
    )
    svc = ProgramService(session)
    program = await svc.create_under_workspace(workspace_id, program_data)
    response.headers["Location"] = f"/programs/{program.id}"
    return program


@router.post(
    "/workspaces/{workspace_id}/programs/{program_id}/copy",
    response_model=ProgramOut,
    status_code=status.HTTP_201_CREATED,
)
async def copy_program_to_workspace(
    session: SessionDep,
    workspace_id: UUID,
    program_id: UUID,
    user_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> ProgramOut:
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.editor
    )
    svc = ProgramService(session)
    original_program = await svc.get(program_id)
    copied_program = ProgramCreate(
        name=original_program.name,
        description=original_program.description,
        equipment=original_program.equipment,
        instructions=original_program.instructions,
        duration=original_program.duration,
        age=original_program.age,
        location=original_program.location,
        count=original_program.count,
        price=original_program.price,
        author_id=user_id,
        content_type=ContentType.program,
        image=original_program.image,
    )
    program = await svc.create_under_workspace(workspace_id, copied_program)
    response.headers["Location"] = f"/programs/{program.id}"
    return program


# ----- item endpoints -----


@router.get("/programs/{program_id}", response_model=ProgramOut)
async def get_program(
    session: SessionDep, program_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> ProgramOut:
    svc = ProgramService(session)
    program = await svc.get(program_id, current_user.id)
    await check_workspace_access(
        program.workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    return program


@router.patch("/programs/{program_id}", response_model=ProgramOut)
async def update_program(
    session: SessionDep,
    program_id: UUID,
    body: ProgramUpdate,
    current_user: UserOut = Depends(get_current_user),
) -> ProgramOut:
    svc = ProgramService(session)
    program = await svc.get(program_id)
    await check_program_edit_access(program.workspace_id, program.author_id, current_user, session)
    return await svc.update(program_id, body)


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    session: SessionDep, program_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    svc = ProgramService(session)
    program = await svc.get(program_id)
    await check_workspace_access(
        program.workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    await svc.delete(program_id)
    return None
