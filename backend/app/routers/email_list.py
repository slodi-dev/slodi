from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.email_list import EmailListCreate, EmailListOut
from app.services.email_list import EmailListService

router = APIRouter(prefix="/emaillist", tags=["emaillist"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/howdoiknow")
async def test_restart():
    """Test endpoint to verify auto-restart is working"""
    return {
        "message": "REMEMBER WHO YOU ARE SIMBA!",  # Change this number each deploy
        "timestamp": datetime.now().isoformat(),
        "status": "running",
        "endpoint": "/emaillist/howdoiknow",
    }


@router.get("", response_model=list[EmailListOut])
async def list_email_list(session: SessionDep):
    svc = EmailListService(session)
    return await svc.list()


@router.post("", response_model=EmailListOut, status_code=status.HTTP_201_CREATED)
async def create_email_entry(session: SessionDep, body: EmailListCreate):
    svc = EmailListService(session)
    return await svc.create(body)


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_entry(session: SessionDep, email: str):
    svc = EmailListService(session)
    await svc.delete(email)
    return None
