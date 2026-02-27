from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.db import get_session
from app.core.limiter import limiter
from app.schemas.email_list import EmailListCreate, EmailListOut
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
@limiter.limit("5/minute")
async def create_email_entry(
    request: Request,
    session: SessionDep,
    body: EmailListCreate,
) -> None:
    """Subscribe an email address to the mailing list. Public endpoint, no auth required."""
    svc = EmailListService(session)
    await svc.create(body)


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_entry(
    session: SessionDep,
    email: str,
    current_user: str = Depends(require_permission(Permissions.admin)),
) -> None:
    svc = EmailListService(session)
    await svc.delete(email)
    return None
