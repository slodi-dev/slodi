# ruff: noqa: B008
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import check_content_read, get_current_user
from app.core.db import get_session
from app.core.rate_limiter import user_rate_limit
from app.schemas.upload import (
    DownloadSasRequest,
    DownloadSasResponse,
    SasRequest,
    SasResponse,
)
from app.schemas.user import UserOut
from app.services.uploads import UploadService

router = APIRouter(prefix="/uploads", tags=["uploads"])
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("/sas", response_model=SasResponse)
async def create_upload_sas(
    body: SasRequest,
    current_user: UserOut = Depends(get_current_user),
    _: None = Depends(user_rate_limit(30, 60)),
) -> SasResponse:
    """Return a 15-minute write-only SAS URL plus the clean blob URL."""
    return UploadService().create_sas(
        user_id=current_user.id,
        purpose=body.purpose,
        content_type=body.content_type,
    )


@router.post("/sas/download", response_model=DownloadSasResponse)
async def create_download_sas(
    body: DownloadSasRequest,
    session: SessionDep,
    current_user: UserOut = Depends(get_current_user),
    _: None = Depends(user_rate_limit(60, 60)),
) -> DownloadSasResponse:
    """A 15-minute download link for your own upload, or for a document on an item you can read."""
    svc = UploadService()
    sas = svc.create_download_sas(blob_name=body.blob_name, filename=body.filename)
    if not svc.uploaded_by(body.blob_name, current_user.id):
        if body.content_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        await check_content_read(body.content_id, current_user, session)
        if not await svc.is_document_of(session, body.content_id, body.blob_name):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return sas
