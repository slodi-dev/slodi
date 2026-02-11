from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.models.content import ContentType
from app.models.user import User
from app.schemas.program import ProgramCreate, ProgramCreateRequest, ProgramOut, ProgramUpdate
from app.services.programs import ProgramService
from app.utils import get_current_datetime

router = APIRouter(tags=["programs"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

# ----- workspace-scoped collection endpoints -----


@router.get("/workspaces/{workspace_id}/programs", response_model=list[ProgramOut])
async def list_workspace_programs(
    session: SessionDep,
    request: Request,
    response: Response,
    workspace_id: UUID,
    limit: Limit = 50,
    offset: Offset = 0,
):
    svc = ProgramService(session)
    total = await svc.count_programs_for_workspace(workspace_id)
    items = await svc.list_for_workspace(workspace_id, limit=limit, offset=offset)
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
    body: ProgramCreateRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    # Inject author_id from authenticated user and set defaults
    program_data = ProgramCreate(
        **body.model_dump(),
        author_id=current_user.id,
        like_count=0,
        created_at=get_current_datetime(),
    )

    svc = ProgramService(session)
    program = await svc.create_under_workspace(workspace_id, program_data)
    response.headers["Location"] = f"/programs/{program.id}"
    return program


async def copy_program_to_workspace(
    session: SessionDep,
    workspace_id: UUID,
    program_id: UUID,
    user_id: UUID,
    response: Response,
) -> ProgramOut:
    svc = ProgramService(session)
    original_program = await svc.get(program_id)
    copied_program = ProgramCreate(
        name=original_program.name,
        description=original_program.description,
        like_count=0,
        author_id=user_id,
        content_type=ContentType.program,
        image=original_program.image,
    )
    program = await svc.create_under_workspace(workspace_id, copied_program)
    response.headers["Location"] = f"/programs/{program.id}"
    return program


# ----- item endpoints -----


@router.get("/programs/{program_id}", response_model=ProgramOut)
async def get_program(session: SessionDep, program_id: UUID):
    svc = ProgramService(session)
    return await svc.get(program_id)


@router.patch("/programs/{program_id}", response_model=ProgramOut)
async def update_program(session: SessionDep, program_id: UUID, body: ProgramUpdate):
    svc = ProgramService(session)
    return await svc.update(program_id, body)


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(session: SessionDep, program_id: UUID):
    svc = ProgramService(session)
    await svc.delete(program_id)
    return None
