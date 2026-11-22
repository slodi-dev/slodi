from __future__ import annotations

import asyncio
import datetime as dt
import logging
import re
from typing import Any
from urllib.parse import quote
from uuid import UUID, uuid4

from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from fastapi import HTTPException, status

from app.domain.upload_constraints import (
    ALLOWED_MIME_TYPES,
    MAX_UPLOAD_BYTES,
    SAS_TTL_MINUTES,
)
from app.schemas.upload import DownloadSasResponse, SasResponse, UploadPurpose
from app.settings import settings

logger = logging.getLogger(__name__)

# The blob names we issue: uploads/{purpose}s/{user_uuid}/{file_uuid}
_BLOB_NAME_RE = re.compile(
    r"^uploads/(?P<kind>images|documents)/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}$"
)


def _account_url() -> str:
    return f"https://{settings.azure_storage_account}.blob.core.windows.net"


def _containers() -> dict[str, UploadPurpose]:
    return {
        settings.azure_storage_container_images: "image",
        settings.azure_storage_container_documents: "document",
    }


def _safe_content_disposition(filename: str | None) -> str:
    """`attachment`, so a disguised file is never rendered; the name RFC 5987-encoded."""
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
    """Short-lived SAS URLs for direct browser-to-blob uploads and downloads."""

    @staticmethod
    def _container_for(purpose: UploadPurpose) -> str:
        # Images go to the public container (served inline via <img>); documents
        # go to the private container (reachable only through a download SAS).
        if purpose == "image":
            return settings.azure_storage_container_images
        return settings.azure_storage_container_documents

    @staticmethod
    def _blob_url(container: str, blob_name: str) -> str:
        return f"{_account_url()}/{container}/{blob_name}"

    def create_sas(
        self,
        *,
        user_id: UUID,
        purpose: UploadPurpose,
        content_type: str,
    ) -> SasResponse:
        # Drop parameters such as "; charset=utf-8".
        normalized = content_type.split(";", 1)[0].strip().lower()
        if normalized not in ALLOWED_MIME_TYPES[purpose]:
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
        match = _BLOB_NAME_RE.match(blob_name)
        if match is None or match.group("kind") != "documents":
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


class AttachmentTooLarge(HTTPException):
    """413 with the file's own size and the ceiling in the message."""

    def __init__(self, *, size: int, limit: int) -> None:
        mb = 1024 * 1024
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Viðhengið er {size / mb:.0f} MB — hámarkið er {limit // mb} MB. "
                "Minnkaðu skrána og reyndu aftur."
            ),
        )


class AttachmentVerifier:
    """The size ceiling a SAS cannot enforce, checked before content may reference a blob.

    Oversized blobs are deleted as well as refused. URLs that are not our blobs are
    left alone: fetching arbitrary URLs from the API would be an SSRF."""

    def __init__(self) -> None:
        self._client: BlobServiceClient | None = None

    def _service(self) -> BlobServiceClient:
        if self._client is None:
            self._client = BlobServiceClient(
                account_url=_account_url(), credential=settings.azure_storage_key
            )
        return self._client

    def _parse(self, url: str) -> tuple[str, str, UploadPurpose] | None:
        """Return (container, blob_name, purpose) for a blob we issued, else None."""
        prefix = _account_url() + "/"
        if not url.startswith(prefix):
            return None
        path = url[len(prefix) :].split("?", 1)[0]
        container, _, blob_name = path.partition("/")
        purpose = _containers().get(container)
        if purpose is None:
            return None
        match = _BLOB_NAME_RE.match(blob_name)
        if match is None:
            return None
        # The container and the path must agree, or a document could be checked
        # against the image ceiling by being addressed through the other one.
        expected = "images" if purpose == "image" else "documents"
        if match.group("kind") != expected:
            return None
        return container, blob_name, purpose

    def check(self, url: str) -> None:
        """Raise if `url` is one of our blobs and exceeds its purpose's ceiling."""
        parsed = self._parse(url)
        if parsed is None:
            return
        container, blob_name, purpose = parsed
        limit = MAX_UPLOAD_BYTES[purpose]
        blob = self._service().get_blob_client(container=container, blob=blob_name)
        try:
            size = blob.get_blob_properties().size
        except Exception:
            # Unverifiable is not the same as too large, and refusing here would
            # make every submission depend on blob storage answering. The
            # ceiling is an abuse control, not a correctness one.
            logger.warning("Could not read the size of %s; letting it through", blob_name)
            return
        if size is not None and size > limit:
            # Delete as well as refuse: an unreferenced oversized blob has no
            # other purpose, and leaving it means the bypass still cost us.
            try:
                blob.delete_blob()
            except Exception:
                logger.warning("Oversized blob %s could not be deleted", blob_name)
            raise AttachmentTooLarge(size=size, limit=limit)

    async def check_content(self, image: str | None, media: dict[str, Any] | None) -> None:
        """Check every blob a piece of content is about to reference.

        The Azure client is synchronous, so the checks run in a worker thread."""
        await asyncio.to_thread(self._check_all, image, media)

    def _check_all(self, image: str | None, media: dict[str, Any] | None) -> None:
        # `image` is usually also in `media.images`, but the client can send them apart.
        if image:
            self.check(image)
        if isinstance(media, dict):
            # Images and documents have different ceilings; `check` reads the
            # purpose back from the blob path, so both lists go through it.
            for key in ("images", "documents"):
                entries = media.get(key)
                if not isinstance(entries, list):
                    continue
                for entry in entries:
                    if isinstance(entry, dict) and isinstance(entry.get("url"), str):
                        self.check(entry["url"])
                    elif isinstance(entry, str):
                        self.check(entry)
