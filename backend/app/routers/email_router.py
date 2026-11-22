# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user, require_permission
from app.core.db import get_session
from app.core.email import (
    SAMPLE_UNSUBSCRIBE_TOKEN,
    send_batch_background,
    send_email_background,
    unsubscribe_page_url,
)
from app.core.email_templates.catalog import PREVIEW_DATA, TEMPLATE_INFO
from app.core.email_templates.renderer import render
from app.domain.enums import Permissions, WorkspaceRole
from app.schemas.email import (
    DraftCreate,
    DraftOut,
    DraftUpdate,
    TemplateInfo,
    WorkspaceInviteRequest,
)
from app.schemas.user import UserOut
from app.services.email_drafts import EmailDraftService, send_draft_by_id
from app.services.workspaces import WorkspaceService
from app.settings import settings

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Depends(require_permission(Permissions.admin))

router = APIRouter(prefix="/emails", tags=["emails"])


@router.post("/workspaces/{workspace_id}/invite", status_code=status.HTTP_202_ACCEPTED)
async def invite_to_workspace(
    workspace_id: UUID,
    body: WorkspaceInviteRequest,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: UserOut = Depends(get_current_user),
) -> None:
    """Send a workspace invitation email. Requires workspace admin role."""
    await check_workspace_access(
        workspace_id, current_user, session, minimum_role=WorkspaceRole.admin
    )
    workspace = await WorkspaceService(session).get(workspace_id)
    html = render(
        "workspace_invite",
        {
            "inviter_name": current_user.name,
            "workspace_name": workspace.name,
            "personal_note": body.message or None,
            "accept_url": settings.public_site_url,
        },
    )
    send_email_background(
        background_tasks,
        recipients=[str(body.email)],
        subject=f"Boð í {workspace.name} á Slóða",
        html=html,
    )


@router.get("/templates", response_model=list[TemplateInfo])
async def list_templates() -> list[TemplateInfo]:
    return [TemplateInfo(**t) for t in TEMPLATE_INFO]


@router.get("/templates/{name}/preview", dependencies=[AdminDep])
async def preview_template(name: str) -> Response:
    """A template rendered with its sample data from catalog.py."""
    if name not in PREVIEW_DATA:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown template: {name}"
        )
    html = render(name, dict(PREVIEW_DATA[name]))
    html = html.replace("{unsubscribe_url}", unsubscribe_page_url(SAMPLE_UNSUBSCRIBE_TOKEN))
    return Response(content=html, media_type="text/html")


@router.post("/drafts", response_model=DraftOut, status_code=status.HTTP_201_CREATED)
async def create_draft(
    body: DraftCreate, session: SessionDep, current_user: UserOut = AdminDep
) -> DraftOut:
    return await EmailDraftService(session).create(body, current_user.id)


@router.get("/drafts", response_model=list[DraftOut], dependencies=[AdminDep])
async def list_drafts(session: SessionDep) -> list[DraftOut]:
    return await EmailDraftService(session).list()


@router.put("/drafts/{draft_id}", response_model=DraftOut, dependencies=[AdminDep])
async def update_draft(draft_id: UUID, body: DraftUpdate, session: SessionDep) -> DraftOut:
    return await EmailDraftService(session).update(draft_id, body)


@router.delete(
    "/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[AdminDep]
)
async def delete_draft(draft_id: UUID, session: SessionDep) -> None:
    """Only a draft or failed draft can be deleted."""
    await EmailDraftService(session).delete(draft_id)


@router.post("/drafts/{draft_id}/send", response_model=DraftOut, dependencies=[AdminDep])
async def send_draft(
    draft_id: UUID, background_tasks: BackgroundTasks, session: SessionDep
) -> DraftOut:
    """Start sending now; the draft is `processing` until the send marks it sent or failed."""
    draft = await EmailDraftService(session).start_sending(draft_id)
    background_tasks.add_task(send_draft_by_id, draft.id)
    return draft


@router.post("/drafts/{draft_id}/test", status_code=status.HTTP_202_ACCEPTED)
async def test_send_draft(
    draft_id: UUID,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: UserOut = AdminDep,
) -> None:
    """Send a test copy to the admin, through the same path as a real send."""
    message = await EmailDraftService(session).test_message(draft_id, current_user.email)
    send_batch_background(background_tasks, [message])
