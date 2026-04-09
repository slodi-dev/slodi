# ruff: noqa: B008
from __future__ import annotations

import datetime as dt
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_workspace_access, get_current_user, require_permission
from app.core.db import get_session
from app.core.email import send_batch_background, send_email_background
from app.core.email_templates.renderer import (
    ALLOWED_TEMPLATES,
    build_render_context,
    get_text_config,
    render,
    save_text_config,
)
from app.domain.enums import Permissions, WorkspaceRole
from app.models.email_draft import EmailDraft
from app.schemas.email import (
    BroadcastOut,
    BroadcastRequest,
    DraftCreate,
    DraftOut,
    DraftUpdate,
    EmailSendRequest,
    RenderRequest,
    TemplateInfo,
    WorkspaceInviteRequest,
)
from app.schemas.user import UserOut
from app.services.email_list import EmailListService
from app.services.workspaces import WorkspaceService
from app.settings import settings

logger = logging.getLogger(__name__)

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

    html = render(
        "workspace_invite",
        {
            "inviter_name": current_user.name,
            "workspace_name": workspace.name,
            "personal_note": body.message or None,
            "accept_url": "https://slodi.is",
        },
    )
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

    if len(subscribers) > settings.resend_max_recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recipient count ({len(subscribers)}) exceeds the configured limit ({settings.resend_max_recipients}). Raise RESEND_MAX_RECIPIENTS to proceed.",
        )

    if subscribers:
        messages: list[tuple[str, str, str]] = []
        for entry in subscribers:
            unsub_url = f"https://slodi.is/unsubscribe?token={entry.unsubscribe_token}"
            messages.append(
                (
                    entry.email,
                    body.subject,
                    body.html.replace("{unsubscribe_url}", unsub_url),
                )
            )
        send_batch_background(background_tasks, messages)

    return BroadcastOut(recipients_count=len(subscribers))


# ---------------------------------------------------------------------------
# Template metadata & preview sample data
# ---------------------------------------------------------------------------

TEMPLATE_METADATA: list[TemplateInfo] = [
    TemplateInfo(
        name="welcome",
        description="New user onboarding email",
        variables=["user_name", "login_url"],
    ),
    TemplateInfo(
        name="workspace_invite",
        description="Workspace invitation",
        variables=["inviter_name", "workspace_name", "personal_note", "accept_url"],
    ),
    TemplateInfo(
        name="newsletter",
        description="Block-based newsletter",
        variables=["subject", "preheader", "blocks"],
    ),
    TemplateInfo(
        name="new_feature",
        description="Feature announcement",
        variables=[
            "feature_name",
            "feature_description",
            "feature_image",
            "feature_details",
            "cta_label",
            "cta_url",
        ],
    ),
]

_PREVIEW_DATA: dict[str, dict[str, object]] = {
    "welcome": {
        "user_name": "Jón Jónsson",
        "login_url": "https://slodi.is",
    },
    "workspace_invite": {
        "inviter_name": "Anna Sigurðardóttir",
        "workspace_name": "Úlfar sveitin",
        "personal_note": "Vertu velkomin\ní hópinn!",
        "accept_url": "https://slodi.is",
    },
    "newsletter": {
        "subject": "Fréttabréf Slóða",
        "preheader": "Nýjustu fréttir frá Slóða",
        "blocks": [
            {"type": "heading", "text": "Velkomin í fréttabréfið"},
            {
                "type": "text",
                "text": (
                    "Hér eru nýjustu fréttir og uppfærslur frá Slóða. "
                    "Við höfum verið að vinna hörðum höndum að nýjum eiginleikum."
                ),
            },
            {
                "type": "image",
                "src": "https://placehold.co/600x300",
                "alt": "Slóði forsíðumynd",
            },
            {
                "type": "feature_card",
                "title": "Nýtt viðburðakerfi",
                "description": "Skipuleggðu viðburði og skráðu þátttakendur á einfaldan hátt.",
            },
            {"type": "divider"},
            {
                "type": "cta",
                "label": "Skoða á Slóða",
                "url": "https://slodi.is",
            },
        ],
    },
    "new_feature": {
        "feature_name": "Viðburðadagatal",
        "feature_description": (
            "Nýtt viðburðadagatal gerir þér kleift að sjá alla viðburði á einum stað "
            "og skipuleggja starf sveitarinnar á skilvirkan hátt."
        ),
        "feature_image": "https://placehold.co/600x300",
        "feature_details": [
            "Skoðaðu alla viðburði í mánaðar- eða vikuyfirliti",
            "Skráðu þátttakendur beint úr dagatalinu",
            "Deildu viðburðum með foreldrum og leiðtogum",
        ],
        "cta_label": "Skoða",
        "cta_url": "https://slodi.is",
    },
}


@router.get("/templates", response_model=list[TemplateInfo])
async def list_templates() -> list[TemplateInfo]:
    """List available email templates with metadata."""
    return TEMPLATE_METADATA


@router.get("/templates/{name}/preview")
async def preview_template(
    name: str,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> Response:
    """Render a template with sample data and return HTML. Admin only."""
    if name not in ALLOWED_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown template: {name}",
        )

    sample_data = _PREVIEW_DATA.get(name)
    if sample_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No preview data for template: {name}",
        )

    try:
        html = render(name, dict(sample_data))
    except Exception:
        logger.exception("Failed to render preview for template '%s'", name)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template rendering failed",
        ) from None

    html = html.replace(
        "{unsubscribe_url}",
        "https://slodi.is/unsubscribe?token=preview",
    )
    return Response(content=html, media_type="text/html")


@router.post("/render")
async def render_template(
    body: RenderRequest,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> Response:
    """Render a template with provided context data. Admin only."""
    try:
        html = render(body.template, body.context)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception:
        logger.exception("Failed to render template '%s'", body.template)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template rendering failed",
        ) from None

    return Response(content=html, media_type="text/html")


# ---------------------------------------------------------------------------
# Template text config
# ---------------------------------------------------------------------------


@router.get("/templates/text")
async def get_template_text(
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> dict[str, dict[str, str]]:
    """Get editable text for all email templates. Admin only."""
    return get_text_config()


@router.put("/templates/text")
async def update_template_text(
    body: dict[str, dict[str, str]],
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> dict[str, dict[str, str]]:
    """Update editable text for email templates. Admin only."""
    save_text_config(body)
    return body


# ---------------------------------------------------------------------------
# Draft CRUD
# ---------------------------------------------------------------------------


@router.post("/drafts", response_model=DraftOut, status_code=status.HTTP_201_CREATED)
async def create_draft(
    body: DraftCreate,
    session: SessionDep,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> DraftOut:
    """Create a new email draft. Admin only."""
    draft = EmailDraft(
        subject=body.subject,
        preheader=body.preheader,
        template=body.template,
        blocks=body.blocks,
        manual_recipients=(
            [str(r) for r in body.manual_recipients] if body.manual_recipients else None
        ),
        scheduled_at=body.scheduled_at,
        status="draft",
        created_by=current_user.id,
    )
    session.add(draft)
    await session.commit()
    await session.refresh(draft)
    return DraftOut.model_validate(draft)


@router.get("/drafts", response_model=list[DraftOut])
async def list_drafts(
    session: SessionDep,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> list[DraftOut]:
    """List all email drafts. Admin only."""
    result = await session.execute(select(EmailDraft).order_by(EmailDraft.created_at.desc()))
    drafts = result.scalars().all()
    return [DraftOut.model_validate(d) for d in drafts]


@router.put("/drafts/{draft_id}", response_model=DraftOut)
async def update_draft(
    draft_id: UUID,
    body: DraftUpdate,
    session: SessionDep,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> DraftOut:
    """Update an email draft. Does not allow status changes. Admin only."""
    draft = await session.get(EmailDraft, draft_id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    update_data = body.model_dump(exclude_unset=True)
    if "manual_recipients" in update_data and update_data["manual_recipients"] is not None:
        update_data["manual_recipients"] = [str(r) for r in update_data["manual_recipients"]]

    for field, value in update_data.items():
        setattr(draft, field, value)

    await session.commit()
    await session.refresh(draft)
    return DraftOut.model_validate(draft)


@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    draft_id: UUID,
    session: SessionDep,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> None:
    """Delete an email draft. Only allowed if status is 'draft' or 'failed'. Admin only."""
    draft = await session.get(EmailDraft, draft_id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    if draft.status not in ("draft", "failed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete draft with status '{draft.status}'",
        )

    await session.delete(draft)
    await session.commit()


@router.post("/drafts/{draft_id}/send", response_model=DraftOut)
async def send_draft(
    draft_id: UUID,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> DraftOut:
    """Send a draft immediately. Admin only."""
    draft = await session.get(EmailDraft, draft_id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    if draft.status not in ("draft", "scheduled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot send draft with status '{draft.status}'",
        )

    draft.status = "processing"
    await session.commit()

    try:
        html = render(draft.template, build_render_context(draft))
    except Exception:
        draft.status = "draft"
        await session.commit()
        logger.exception("Failed to render draft %s", draft_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template rendering failed",
        ) from None

    messages: list[tuple[str, str, str]] = []

    if draft.manual_recipients:
        for recipient in draft.manual_recipients:
            recipient_html = html.replace("{unsubscribe_url}", "https://slodi.is/unsubscribe")
            messages.append((recipient, draft.subject, recipient_html))
    else:
        subscribers = await EmailListService(session).list()
        for subscriber in subscribers:
            unsub_url = f"https://slodi.is/unsubscribe?token={subscriber.unsubscribe_token}"
            subscriber_html = html.replace("{unsubscribe_url}", unsub_url)
            messages.append((subscriber.email, draft.subject, subscriber_html))

    if messages:
        send_batch_background(background_tasks, messages)

    draft.status = "sent"
    draft.sent_at = dt.datetime.now(dt.timezone.utc)
    await session.commit()
    await session.refresh(draft)
    return DraftOut.model_validate(draft)


@router.post("/drafts/{draft_id}/test", status_code=status.HTTP_202_ACCEPTED)
async def test_send_draft(
    draft_id: UUID,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: UserOut = Depends(require_permission(Permissions.admin)),
) -> None:
    """Send a test email of a draft to the admin's own email. Admin only."""
    draft = await session.get(EmailDraft, draft_id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    html = render(draft.template, build_render_context(draft))
    html = html.replace("{unsubscribe_url}", "https://slodi.is/unsubscribe?token=test")

    send_email_background(
        background_tasks,
        recipients=[current_user.email],
        subject=f"[TEST] {draft.subject}",
        html=html,
    )
