from __future__ import annotations

import datetime as dt
import re
from urllib.parse import quote
from uuid import UUID, uuid4

from azure.storage.blob import BlobSasPermissions, generate_blob_sas
from fastapi import HTTPException, status

from app.domain.upload_constraints import ALLOWED_MIME_TYPES, SAS_TTL_MINUTES
from app.schemas.upload import DownloadSasResponse, SasResponse, UploadPurpose
from app.settings import settings

# Blob names we issue look like: uploads/{purpose}s/{user_uuid}/{file_uuid}
# Downloads only apply to the private documents container, so the download path
# regex is scoped to that prefix — a SAS can never be minted for another blob.
_DOCUMENT_BLOB_NAME_RE = re.compile(r"^uploads/documents/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}$")


def _safe_content_disposition(filename: str | None) -> str:
    """Build a ``Content-Disposition: attachment`` value, header-injection safe.

    Forcing ``attachment`` makes the browser download the file instead of
    rendering it, so a blob whose bytes are secretly HTML can never execute when
    a user opens it. The filename is sanitised and encoded per RFC 5987 so
    Icelandic characters (þ, æ, ö, ...) survive the round-trip.
    """
    if not filename:
        return "attachment"

    # Drop any path components and characters that could break out of the header.
    cleaned = filename.replace("\r", "").replace("\n", "").strip()
    cleaned = cleaned.rsplit("/", 1)[-1].rsplit("\\", 1)[-1][:200]
    if not cleaned:
        return "attachment"

    ascii_fallback = (
        cleaned.encode("ascii", "replace").decode("ascii").replace('"', "").replace("\\", "")
    )
    utf8_encoded = quote(cleaned, safe="")
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{utf8_encoded}"


class UploadService:
    """Issues short-lived SAS URLs for direct browser-to-blob uploads and downloads.

    The backend never proxies file bytes. For uploads it validates the requested
    content type and mints a write-only SAS scoped to a single UUID blob name.
    For downloads it mints a read-only SAS that forces an ``attachment`` response,
    so a mislabelled blob (e.g. HTML masquerading as a PDF) is downloaded inertly
    rather than rendered in the browser.
    """

    @staticmethod
    def _container_for(purpose: UploadPurpose) -> str:
        # Images go to the public container (served inline via <img>); documents
        # go to the private container (reachable only through a download SAS).
        if purpose == "image":
            return settings.azure_storage_container_images
        return settings.azure_storage_container_documents

    @staticmethod
    def _blob_url(container: str, blob_name: str) -> str:
        return (
            f"https://{settings.azure_storage_account}.blob.core.windows.net/"
            f"{container}/{blob_name}"
        )

    def create_sas(
        self,
        *,
        user_id: UUID,
        purpose: UploadPurpose,
        content_type: str,
    ) -> SasResponse:
        allowed = ALLOWED_MIME_TYPES.get(purpose)
        if allowed is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown upload purpose: {purpose}",
            )

        # Strip any parameters (e.g. "; charset=utf-8") and normalise for matching.
        normalized = content_type.split(";", 1)[0].strip().lower()
        if normalized not in allowed:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Content type '{normalized}' is not allowed for {purpose} uploads.",
            )

        container = self._container_for(purpose)
        # UUID blob name namespaced by purpose and uploader; no client input in the path.
        blob_name = f"uploads/{purpose}s/{user_id}/{uuid4()}"
        expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=SAS_TTL_MINUTES)

        sas_token = generate_blob_sas(
            account_name=settings.azure_storage_account,
            container_name=container,
            blob_name=blob_name,
            account_key=settings.azure_storage_key,
            permission=BlobSasPermissions(create=True, write=True),
            expiry=expires_at,
            protocol="https",
        )

        # For images the container is public, so blob_url is directly usable in
        # <img>. For documents it is the canonical path; the bytes are only
        # retrievable via create_download_sas.
        base_url = self._blob_url(container, blob_name)
        return SasResponse(
            upload_url=f"{base_url}?{sas_token}",
            blob_url=base_url,
            expires_at=expires_at,
        )

    def create_download_sas(
        self,
        *,
        blob_name: str,
        filename: str | None = None,
    ) -> DownloadSasResponse:
        if not _DOCUMENT_BLOB_NAME_RE.match(blob_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid blob name.",
            )

        container = settings.azure_storage_container_documents
        expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=SAS_TTL_MINUTES)

        sas_token = generate_blob_sas(
            account_name=settings.azure_storage_account,
            container_name=container,
            blob_name=blob_name,
            account_key=settings.azure_storage_key,
            permission=BlobSasPermissions(read=True),
            expiry=expires_at,
            protocol="https",
            # Force a download response regardless of the blob's stored type, so a
            # disguised file cannot be rendered (and executed) in the browser.
            content_disposition=_safe_content_disposition(filename),
        )

        return DownloadSasResponse(
            download_url=f"{self._blob_url(container, blob_name)}?{sas_token}",
            expires_at=expires_at,
        )
