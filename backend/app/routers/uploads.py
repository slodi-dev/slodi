# ruff: noqa: B008
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
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
    current_user: UserOut = Depends(get_current_user),
    _: None = Depends(user_rate_limit(60, 60)),
) -> DownloadSasResponse:
    """Return a 15-minute read-only SAS URL that forces a safe file download."""
    return UploadService().create_download_sas(
        blob_name=body.blob_name,
        filename=body.filename,
    )
