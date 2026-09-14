from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

UploadPurpose = Literal["image", "document"]


class SasRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content_type: str = Field(..., max_length=255)
    purpose: UploadPurpose


class SasResponse(BaseModel):
    # Short-lived, write-only URL the client PUTs the file to.
    upload_url: str
    # Stable URL of the blob once uploaded (no token).
    blob_url: str
    expires_at: dt.datetime


class DownloadSasRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Path of the blob to download, as returned in SasResponse.blob_url.
    blob_name: str = Field(..., max_length=255)
    # Optional display name for the downloaded file (shown in the save dialog).
    filename: str | None = Field(default=None, max_length=255)


class DownloadSasResponse(BaseModel):
    # Short-lived, read-only URL that forces a safe download (attachment).
    download_url: str
    expires_at: dt.datetime
