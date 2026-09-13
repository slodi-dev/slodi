from __future__ import annotations

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

# Blob names we issue look like: uploads/{purpose}s/{user_uuid}/{file_uuid}
# Downloads only apply to the private documents container, so the download path
# regex is scoped to that prefix — a SAS can never be minted for another blob.
logger = logging.getLogger(__name__)

_DOCUMENT_BLOB_NAME_RE = re.compile(r"^uploads/documents/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}$")
_ANY_BLOB_NAME_RE = re.compile(
    r"^uploads/(?P<kind>images|documents)/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}$"
)


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
    """Enforces the size ceiling that a SAS cannot.

    A blob SAS grants write permission for a window; the client then PUTs
    whatever it likes straight to Azure with nothing in this codebase in the
    path. The frontend refuses an oversized file before uploading, but that is
    a courtesy — it can be bypassed by anyone willing to call the API directly.

    So this is the enforcement point: before a `Content` row is allowed to
    *reference* a blob we issued, the blob's actual length is read and checked.
    An oversized blob is **deleted** as well as refused, because an unreferenced
    oversized blob has no other purpose and leaving it would mean the bypass
    still cost us the storage.

    URLs that are not blobs we issued are left alone. `Content.image` may
    legitimately be a link to a picture hosted elsewhere — that costs us no
    storage, and HEADing an arbitrary URL from the API would be an SSRF the
    feature does not need.
    """

    def __init__(self) -> None:
        self._client: BlobServiceClient | None = None

    def _service(self) -> BlobServiceClient:
        if self._client is None:
            self._client = BlobServiceClient(
                account_url=f"https://{settings.azure_storage_account}.blob.core.windows.net",
                credential=settings.azure_storage_key,
            )
        return self._client

    def _parse(self, url: str) -> tuple[str, str, UploadPurpose] | None:
        """Return (container, blob_name, purpose) for a blob we issued, else None."""
        prefix = f"https://{settings.azure_storage_account}.blob.core.windows.net/"
        if not url.startswith(prefix):
            return None
        path = url[len(prefix) :].split("?", 1)[0]
        container, _, blob_name = path.partition("/")
        containers = {
            settings.azure_storage_container_images: "image",
            settings.azure_storage_container_documents: "document",
        }
        purpose = containers.get(container)
        if purpose is None:
            return None
        match = _ANY_BLOB_NAME_RE.match(blob_name)
        if match is None:
            return None
        # The container and the path must agree, or a document could be checked
        # against the image ceiling by being addressed through the other one.
        expected = "images" if purpose == "image" else "documents"
        if match.group("kind") != expected:
            return None
        return container, blob_name, purpose  # type: ignore[return-value]

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

    def check_content(self, image: str | None, media: dict[str, Any] | None) -> None:
        """Check every blob a piece of content is about to reference.

        `image` is the hero and is also the first entry of `media.images`, so
        it is checked twice on a normal submit. That is deliberate: the two can
        be set independently over the wire, and a ceiling that only holds when
        the client keeps them in step is not a ceiling.
        """
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
