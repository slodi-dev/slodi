from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.db import get_session
from app.schemas.email_list import EmailListCreate, EmailListOut
from app.schemas.user import Permissions
from app.services.email_list import EmailListService

router = APIRouter(prefix="/emaillist", tags=["emaillist"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=list[EmailListOut])
async def list_email_list(
    session: SessionDep, current_user: str = Depends(require_permission(Permissions.admin))
):
    svc = EmailListService(session)
    return await svc.list()


@router.post("", response_model=EmailListOut, status_code=status.HTTP_201_CREATED)
async def create_email_entry(
    session: SessionDep,
    body: EmailListCreate,
    current_user: str = Depends(get_current_user),
):
    svc = EmailListService(session)
    return await svc.create(body)


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_entry(
    session: SessionDep,
    email: str,
    current_user: str = Depends(require_permission(Permissions.admin)),
):
    svc = EmailListService(session)
    await svc.delete(email)
    return None
