from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.db import get_session
from app.core.rate_limiter import ip_rate_limit
from app.domain.enums import Permissions
from app.schemas.email_list import EmailListCreate, EmailListOut, SubscriptionStatusOut
from app.services.email_list import EmailListService

router = APIRouter(prefix="/emaillist", tags=["emaillist"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Depends(require_permission(Permissions.admin))


@router.get("", response_model=list[EmailListOut], dependencies=[AdminDep])
async def list_email_list(session: SessionDep) -> list[EmailListOut]:
    return await EmailListService(session).list()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_email_entry(
    request: Request,
    session: SessionDep,
    body: EmailListCreate,
    _: None = Depends(ip_rate_limit(5, 60)),
) -> None:
    """Subscribe to the mailing list. Public; the answer is the same whether or not the
    address was already on it."""
    await EmailListService(session).create(body)


@router.get("/unsubscribe/{token}", response_model=SubscriptionStatusOut)
async def check_unsubscribe_token(token: UUID, session: SessionDep) -> SubscriptionStatusOut:
    """Read-only: mail scanners prefetch links, so a GET must never unsubscribe anyone."""
    return await EmailListService(session).subscription_status(token)


@router.post("/unsubscribe/{token}", response_model=SubscriptionStatusOut)
async def unsubscribe_by_token(token: UUID, session: SessionDep) -> SubscriptionStatusOut:
    """RFC 8058 one-click target (no credentials, body ignored) and the page's confirm button."""
    return await EmailListService(session).unsubscribe_by_token(token)


@router.post("/resubscribe/{token}", response_model=SubscriptionStatusOut)
async def resubscribe_by_token(token: UUID, session: SessionDep) -> SubscriptionStatusOut:
    """Undo an unsubscribe with the same token ("Skrá mig aftur")."""
    return await EmailListService(session).resubscribe_by_token(token)


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[AdminDep])
async def delete_email_entry(session: SessionDep, email: str) -> None:
    await EmailListService(session).delete(email)
