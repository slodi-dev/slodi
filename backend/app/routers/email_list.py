from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.db import get_session
from app.core.rate_limiter import ip_rate_limit
from app.schemas.email_list import EmailListCreate, EmailListOut, SubscriptionStatusOut
from app.schemas.user import Permissions
from app.services.email_list import EmailListService

router = APIRouter(prefix="/emaillist", tags=["emaillist"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=list[EmailListOut])
async def list_email_list(
    session: SessionDep, current_user: str = Depends(require_permission(Permissions.admin))
) -> list[EmailListOut]:
    svc = EmailListService(session)
    return await svc.list()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_email_entry(
    request: Request,
    session: SessionDep,
    body: EmailListCreate,
    _: None = Depends(ip_rate_limit(5, 60)),
) -> None:
    """Subscribe an email address to the mailing list. Public endpoint, no auth required."""
    svc = EmailListService(session)
    await svc.create(body)


@router.get("/unsubscribe/{token}", response_model=SubscriptionStatusOut)
async def check_unsubscribe_token(token: UUID, session: SessionDep) -> SubscriptionStatusOut:
    """Report where a token's address stands, without changing anything.

    GET must not change state: mail scanners and link previewers fetch links
    in emails on their own, which would otherwise unsubscribe people who
    never clicked. The unsubscribe page uses this to decide whether to show
    the confirm button or "already unsubscribed". 404 only for a token that
    never existed.
    """
    return await EmailListService(session).subscription_status(token)


@router.post("/unsubscribe/{token}", response_model=SubscriptionStatusOut)
async def unsubscribe_by_token(token: UUID, session: SessionDep) -> SubscriptionStatusOut:
    """Unsubscribe via the token included in list emails. Public, no auth.

    This is the RFC 8058 one-click target of the List-Unsubscribe header:
    mail providers POST ``List-Unsubscribe=One-Click`` here with no cookies
    or credentials, and unsubscribe immediately with no confirmation. The body
    carries nothing we need, so it is ignored. The unsubscribe page's confirm
    button posts here too, via the Next proxy.

    Idempotent: 200 whether or not the address was still subscribed
    (``changed`` says which), so a retry or a second click is not an error.
    """
    return await EmailListService(session).unsubscribe_by_token(token)


@router.post("/resubscribe/{token}", response_model=SubscriptionStatusOut)
async def resubscribe_by_token(token: UUID, session: SessionDep) -> SubscriptionStatusOut:
    """Undo an unsubscribe with the same token ("Skrá mig aftur"). Public, no auth.

    POST only, for the same reason as unsubscribing: a prefetched GET must
    never change someone's subscription.
    """
    return await EmailListService(session).resubscribe_by_token(token)


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_entry(
    session: SessionDep,
    email: str,
    current_user: str = Depends(require_permission(Permissions.admin)),
) -> None:
    svc = EmailListService(session)
    await svc.delete(email)
    return None
