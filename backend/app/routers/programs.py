# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    apply_review_visibility,
    assert_hidden_item_readable,
    check_content_create_access,
    check_content_edit_access,
    check_workspace_access,
    get_current_user,
    require_not_suspended,
)
from app.core.db import get_session
from app.core.pagination import Limit, Offset, add_pagination_headers
from app.core.rate_limiter import user_rate_limit
from app.domain.enums import AgeGroup, ContentType, ProgramSortBy
from app.schemas.content import ContentListOut, ContentOut
from app.schemas.program import (
    ProgramCreate,
    ProgramFilters,
    ProgramListOut,
    ProgramOut,
    ProgramUpdate,
)
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceRole
from app.services.events import EventService
from app.services.programs import ProgramService
from app.services.tasks import TaskService
from app.utils import get_current_datetime

router = APIRouter(tags=["programs"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]

# ----- workspace-scoped collection endpoints -----


@router.get("/workspaces/{workspace_id}/content", response_model=list[ContentListOut])
async def list_workspace_content(
    session: SessionDep,
    request: Request,
    response: Response,
    workspace_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
    search: str | None = Query(
        default=None,
        description="Case-insensitive search on program name and description",
    ),
    age: list[AgeGroup] | None = Query(
        default=None,
        description="Filter by age groups (OR logic)",
    ),
    duration_min: int | None = Query(
        default=None,
        ge=0,
        description="Minimum duration in minutes (programs with duration_min >= this value)",
    ),
    duration_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum duration in minutes (programs with duration_max <= this value)",
    ),
    prep_time_min: int | None = Query(
        default=None,
        ge=0,
        description="Minimum prep time in minutes (programs with prep_time_min >= this value)",
    ),
    prep_time_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum prep time in minutes (programs with prep_time_max <= this value)",
    ),
    count_min: int | None = Query(
        default=None,
        ge=0,
        description="Minimum participant count (programs with count_min >= this value)",
    ),
    count_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum participant count (programs with count_max <= this value)",
    ),
    price_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum price in ISK (0 = free programs only)",
    ),
    location: str | None = Query(
        default=None,
        description="Case-insensitive partial match on program location",
    ),
    equipment: list[str] | None = Query(
        default=None,
        description="Filter by equipment items (OR logic — programs with any of these items)",
    ),
    tags: list[str] | None = Query(
        default=None,
        description="Filter by tag names (OR logic, case-insensitive)",
    ),
    author_id: UUID | None = Query(
        default=None,
        description="Filter by author ID (exact UUID match)",
    ),
    author: str | None = Query(
        default=None,
        description="Case-insensitive partial match on the author's name",
    ),
    sort_by: ProgramSortBy | None = Query(
        default=None,
        description="Sort order",
    ),
) -> list[ContentListOut]:
    """Everything in the bank, whatever kind it is.

    `/programs` returns only rows whose `content_type` is `program`. That was
    indistinguishable from "everything" while the create form filed every
    submission as a program — and it stopped being so the moment the chooser
    started filing a Verkefni as a task, at which point correctly-typed
    submissions vanished from the bank they had just been added to.
    """
    svc = ProgramService(session)
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )

    filters = ProgramFilters(
        search=search,
        age=age,
        duration_min=duration_min,
        duration_max=duration_max,
        prep_time_min=prep_time_min,
        prep_time_max=prep_time_max,
        count_min=count_min,
        count_max=count_max,
        price_max=price_max,
        location=location,
        equipment=equipment,
        tags=tags,
        author_id=author_id,
        author_name=author,
        sort_by=sort_by,
    )

    total = await svc.count_content_for_workspace(workspace_id, filters=filters)
    items = await svc.list_content_for_workspace(
        workspace_id, current_user.id, limit=limit, offset=offset, filters=filters
    )
    add_pagination_headers(
        response=response,
        request=request,
        total=total,
        limit=limit,
        offset=offset,
    )
    return items


@router.get("/workspaces/{workspace_id}/programs", response_model=list[ProgramListOut])
async def list_workspace_programs(
    session: SessionDep,
    request: Request,
    response: Response,
    workspace_id: UUID,
    current_user: UserOut = Depends(get_current_user),
    limit: Limit = 50,
    offset: Offset = 0,
    search: str | None = Query(
        default=None,
        description="Case-insensitive search on program name and description",
    ),
    age: list[AgeGroup] | None = Query(
        default=None,
        description="Filter by age groups (OR logic)",
    ),
    duration_min: int | None = Query(
        default=None,
        ge=0,
        description="Minimum duration in minutes (programs with duration_min >= this value)",
    ),
    duration_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum duration in minutes (programs with duration_max <= this value)",
    ),
    prep_time_min: int | None = Query(
        default=None,
        ge=0,
        description="Minimum prep time in minutes (programs with prep_time_min >= this value)",
    ),
    prep_time_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum prep time in minutes (programs with prep_time_max <= this value)",
    ),
    count_min: int | None = Query(
        default=None,
        ge=0,
        description="Minimum participant count (programs with count_min >= this value)",
    ),
    count_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum participant count (programs with count_max <= this value)",
    ),
    price_max: int | None = Query(
        default=None,
        ge=0,
        description="Maximum price in ISK (0 = free programs only)",
    ),
    location: str | None = Query(
        default=None,
        description="Case-insensitive partial match on program location",
    ),
    equipment: list[str] | None = Query(
        default=None,
        description="Filter by equipment items (OR logic — programs with any of these items)",
    ),
    author_id: UUID | None = Query(
        default=None,
        description="Filter by author ID (exact UUID match)",
    ),
    sort_by: ProgramSortBy | None = Query(
        default=None,
        description="Sort order",
    ),
) -> list[ProgramListOut]:
    svc = ProgramService(session)
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )

    filters = ProgramFilters(
        search=search,
        age=age,
        duration_min=duration_min,
        duration_max=duration_max,
        prep_time_min=prep_time_min,
        prep_time_max=prep_time_max,
        count_min=count_min,
        count_max=count_max,
        price_max=price_max,
        location=location,
        equipment=equipment,
        author_id=author_id,
        sort_by=sort_by,
    )

    total = await svc.count_programs_for_workspace(workspace_id, filters=filters)
    items = await svc.list_for_workspace(
        workspace_id, current_user.id, limit=limit, offset=offset, filters=filters
    )
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
    _suspension: UserOut = Depends(require_not_suspended),
    _: None = Depends(user_rate_limit(20, 60)),
) -> ProgramOut:
    await check_content_create_access(workspace_id, current_user, session)
    # author_id and created_at are server-owned — see ContentCreate.
    program_data = body.model_copy(
        update={"author_id": current_user.id, "created_at": get_current_datetime()}
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
    response: Response,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
    _: None = Depends(user_rate_limit(20, 60)),
) -> ProgramOut:
    await check_content_create_access(workspace_id, current_user, session)
    svc = ProgramService(session)
    original_program = await svc.get(program_id)
    # Copying is a read of the source. Without this a caller could lift a
    # programme out of a workspace they cannot open, into one they own.
    await check_workspace_access(
        original_program.workspace_id,
        current_user,
        session,
        minimum_role=WorkspaceRole.viewer,
        hide_from_non_members=True,
    )
    copied_program = ProgramCreate(
        name=original_program.name,
        description=original_program.description,
        equipment=original_program.equipment,
        instructions=original_program.instructions,
        duration_min=original_program.duration_min,
        duration_max=original_program.duration_max,
        age=original_program.age,
        location=original_program.location,
        count_min=original_program.count_min,
        count_max=original_program.count_max,
        price=original_program.price,
        prep_time_min=original_program.prep_time_min,
        prep_time_max=original_program.prep_time_max,
        media=original_program.media,
        author_id=current_user.id,
        created_at=get_current_datetime(),
        content_type=ContentType.program,
        image=original_program.image,
        tag_names=[t.name for t in original_program.tags],
    )
    program = await svc.create_under_workspace(workspace_id, copied_program)
    response.headers["Location"] = f"/programs/{program.id}"
    return program


# ----- item endpoints -----


@router.get("/workspaces/{workspace_id}/content/facets", response_model=dict[str, list[str]])
async def list_workspace_content_facets(
    session: SessionDep,
    workspace_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> dict[str, list[str]]:
    """The values the filter sidebar can offer: locations, equipment, authors, tags.

    The browser used to derive these from the rows it happened to have. Once the
    grid pages server-side that list is one page long, so the options have to
    come from the bank rather than from the page.
    """
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.viewer
    )
    svc = ProgramService(session)
    # The vocabulary moves when someone submits, not between two clicks of a
    # checkbox, so a short shared cache is safe and saves four DISTINCTs a page.
    response.headers["Cache-Control"] = "private, max-age=300"
    return await svc.facets_for_workspace(workspace_id)


@router.get("/content/{content_id}", response_model=ContentOut)
async def get_content(
    session: SessionDep,
    content_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> ContentOut:
    """Read one bank item, whatever kind it is.

    `GET /programs/{id}` selects `Program`, and under joined-table inheritance
    that matches only rows whose discriminator is "program". Once the chooser
    started filing a Verkefni as a `task`, every item a leader submitted
    returned 404 from the detail page it was linked to — the listing had
    already moved to `/content` for exactly this reason, and the read-one path
    had not followed.

    Each subtype keeps its own loader because each eager-loads relationships
    the others do not have (`Program.events`, `Event.tasks`), so this resolves
    the discriminator first and then delegates.
    """
    svc = ProgramService(session)
    content_type = await svc.repo.get_content_type(content_id)
    if content_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    # Fetched including hidden, then gated on who is asking: the repository
    # cannot answer "is this reader its author?" without first loading the row.
    item: ContentOut
    if content_type == ContentType.program:
        item = await svc.get(content_id, current_user.id, include_hidden=True)
    elif content_type == ContentType.event:
        item = await EventService(session).get(content_id, current_user.id, include_hidden=True)
    else:
        item = await TaskService(session).get(content_id, current_user.id, include_hidden=True)

    await check_workspace_access(
        item.workspace_id,
        current_user,
        session,
        minimum_role=WorkspaceRole.viewer,
        hide_from_non_members=True,
    )

    assert_hidden_item_readable(item, current_user)

    response.headers["Cache-Control"] = "private, max-age=60"
    return apply_review_visibility(item, current_user)


@router.get("/programs/{program_id}", response_model=ProgramOut)
async def get_program(
    session: SessionDep,
    program_id: UUID,
    response: Response,
    current_user: UserOut = Depends(get_current_user),
) -> ProgramOut:
    svc = ProgramService(session)
    program = await svc.get(program_id, current_user.id, include_hidden=True)
    await check_workspace_access(
        program.workspace_id,
        current_user,
        session,
        minimum_role=WorkspaceRole.viewer,
        hide_from_non_members=True,
    )
    assert_hidden_item_readable(program, current_user)

    response.headers["Cache-Control"] = "private, max-age=60"
    return apply_review_visibility(program, current_user)


@router.patch("/programs/{program_id}", response_model=ProgramOut)
async def update_program(
    session: SessionDep,
    program_id: UUID,
    body: ProgramUpdate,
    current_user: UserOut = Depends(get_current_user),
    _suspension: UserOut = Depends(require_not_suspended),
) -> ProgramOut:
    svc = ProgramService(session)
    program = await svc.get(program_id)
    await check_content_edit_access(
        program.workspace_id,
        program.author_id,
        current_user,
        session,
        hide_from_non_members=True,
    )
    return apply_review_visibility(
        await svc.update(program_id, body, current_user.id), current_user
    )


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    session: SessionDep, program_id: UUID, current_user: UserOut = Depends(get_current_user)
) -> None:
    svc = ProgramService(session)
    program = await svc.get(program_id)
    await check_content_edit_access(
        program.workspace_id,
        program.author_id,
        current_user,
        session,
        hide_from_non_members=True,
    )
    await svc.delete(program_id)
    return None
