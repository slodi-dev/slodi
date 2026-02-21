# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user, require_permission
from app.core.db import get_session
from app.core.email import send_email_background
from app.models.user import Permissions
from app.models.workspace import WorkspaceRole
from app.schemas.email import (
    BroadcastOut,
    BroadcastRequest,
    EmailSendRequest,
    WorkspaceInviteRequest,
)
from app.schemas.user import UserOut
from app.services.email_list import EmailListService
from app.services.workspaces import WorkspaceService

SessionDep = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter(prefix="/emails", tags=["emails"])


@router.post("/send", status_code=status.HTTP_202_ACCEPTED)
async def send_email(
    body: EmailSendRequest,
    background_tasks: BackgroundTasks,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> None:
    """Send a custom email to one or more recipients. Admin only."""
    send_email_background(
        background_tasks,
        recipients=[str(r) for r in body.recipients],
        subject=body.subject,
        html=body.html,
    )


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

    personal_note = f"<p><em>{body.message}</em></p>" if body.message else ""
    html = f"""
<p>{current_user.name} hefur boðið þér í vinnusvæðið
<strong>{workspace.name}</strong> á Slóða.</p>
{personal_note}
<p><a href="https://slodi.is">Opna Slóða</a></p>
"""
    send_email_background(
        background_tasks,
        recipients=[str(body.email)],
        subject=f"Boð í {workspace.name} á Slóða",
        html=html,
    )


@router.post("/broadcast", response_model=BroadcastOut, status_code=status.HTTP_202_ACCEPTED)
async def broadcast_to_email_list(
    body: BroadcastRequest,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> BroadcastOut:
    """Broadcast an email to all subscribers on the email list. Admin only."""
    subscribers = await EmailListService(session).list()
    recipients = [entry.email for entry in subscribers]

    if recipients:
        send_email_background(
            background_tasks,
            recipients=recipients,
            subject=body.subject,
            html=body.html,
        )

    return BroadcastOut(recipients_count=len(recipients))
