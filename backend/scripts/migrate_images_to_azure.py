"""
One-off migration: re-host external content images on Azure Blob Storage.

Content images used to be free-text URLs pointing anywhere on the internet,
which forced ``next.config.ts`` to allow ``hostname: "**"``. This script fetches
each external image, re-uploads it to the public images container using the same
blob-naming scheme the runtime SAS endpoint uses, and rewrites ``content.image``
to the new blob URL. Once every row has been migrated, ``remotePatterns`` can be
locked to the storage account's hostname.

The script is idempotent: rows whose image already points at our storage account
are skipped, so it can be re-run safely after fixing individual failures.

Every rewritten row is appended to a CSV (``--record``, timestamped by default)
holding ``content_id,old_url,new_url``. Because the migration overwrites
``content.image`` in place, that file is the only copy of the original URLs
outside a full database dump — keep it until the migration is confirmed good.

Usage:
    PYTHONPATH=. uv run python scripts/migrate_images_to_azure.py --dry-run
    PYTHONPATH=. uv run python scripts/migrate_images_to_azure.py
or via the Makefile:
    make migrate-images-dry
    make migrate-images
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import ipaddress
import logging
import socket
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID, uuid4

import httpx
from azure.storage.blob import BlobServiceClient, ContentSettings
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session_maker
from app.domain.content_constraints import IMG_MAX
from app.domain.upload_constraints import ALLOWED_MIME_TYPES
from app.models.content import Content
from app.settings import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

ALLOWED_IMAGE_TYPES = ALLOWED_MIME_TYPES["image"]

# Existing images predate the frontend's 5 MB guard, so the ceiling here is
# deliberately looser — failing an oversized row would leave it pointing at an
# external URL that breaks the moment remotePatterns is locked down.
DEFAULT_MAX_BYTES = 10 * 1024 * 1024

FETCH_TIMEOUT_SECONDS = 30.0
MAX_REDIRECTS = 5

# Blobs are immutable (UUID names), so they can be cached indefinitely.
CACHE_CONTROL = "public, max-age=31536000, immutable"

# Magic-byte prefixes, used when a server sends a useless Content-Type such as
# application/octet-stream. Order matters only in that WebP is checked on the
# RIFF container, not the leading bytes alone.
_MAGIC_PREFIXES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


# ── Result tracking ────────────────────────────────────────────────────────────


@dataclass
class Report:
    migrated: int = 0
    skipped_already_azure: int = 0
    skipped_not_http: int = 0
    failures: list[tuple[UUID, str, str]] = field(default_factory=list)
    record_path: Path | None = None

    def fail(self, content_id: UUID, url: str, reason: str) -> None:
        self.failures.append((content_id, url, reason))
        log.warning("FAILED %s (%s): %s", content_id, url, reason)


class MigrationError(Exception):
    """A single row could not be migrated; the run continues."""


class Recorder:
    """Appends an ``id,old_url,new_url`` row per migration, for rollback.

    The script overwrites ``content.image`` in place, so without this file the
    original URL survives only inside a full database dump. Each row is flushed
    immediately, so a killed or crashed run still leaves a usable record of
    everything it actually changed.

    To roll back, feed the file to::

        UPDATE content SET image = :old_url WHERE id = :content_id;
    """

    HEADER = ("content_id", "old_url", "new_url", "migrated_at")

    def __init__(self, path: Path) -> None:
        self.path = path
        new_file = not path.exists() or path.stat().st_size == 0
        self._handle = path.open("a", newline="", encoding="utf-8")
        self._writer = csv.writer(self._handle)
        if new_file:
            self._writer.writerow(self.HEADER)
            self._handle.flush()

    def write(self, content_id: UUID, old_url: str, new_url: str) -> None:
        self._writer.writerow(
            [str(content_id), old_url, new_url, dt.datetime.now(dt.timezone.utc).isoformat()]
        )
        self._handle.flush()

    def close(self) -> None:
        self._handle.close()


# ── Helpers ────────────────────────────────────────────────────────────────────


def azure_url_prefix() -> str:
    """The URL prefix that marks an image as already migrated."""
    return f"https://{settings.azure_storage_account}.blob.core.windows.net/"


def default_record_path() -> Path:
    """A fresh timestamped record per run, so re-runs never clobber an older one."""
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d_%H%M%S")
    return Path(f"image_migration_{stamp}.csv")


def sniff_content_type(body: bytes) -> str:
    """Identify the image's MIME type from its magic bytes, or "" if unrecognised.

    The remote server's Content-Type header is deliberately ignored. These URLs
    are user-supplied and the images container is public, so a file served as
    ``image/png`` but containing HTML would be re-hosted on our own domain under
    an image label. Every type in the allowlist has a signature, so trusting the
    bytes alone costs nothing and rejects mislabelled content outright.
    """
    for prefix, mime in _MAGIC_PREFIXES:
        if body.startswith(prefix):
            return mime
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "image/webp"
    return ""


def assert_public_url(url: str) -> None:
    """Reject URLs resolving to private or loopback addresses.

    The stored URLs are user-supplied, so fetching them server-side is an SSRF
    sink — the exact class of problem this migration exists to close. Anything
    that resolves inside the network is refused rather than fetched.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise MigrationError(f"unsupported scheme '{parsed.scheme}'")
    host = parsed.hostname
    if not host:
        raise MigrationError("URL has no hostname")

    try:
        addr_info = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise MigrationError(f"DNS resolution failed: {exc}") from exc

    for info in addr_info:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise MigrationError(f"host {host} resolves to non-public address {ip}")


async def fetch_image(client: httpx.AsyncClient, url: str, max_bytes: int) -> tuple[bytes, str]:
    """Download an image, enforcing the size cap while streaming."""
    assert_public_url(url)

    try:
        async with client.stream("GET", url) as response:
            if response.status_code != httpx.codes.OK:
                raise MigrationError(f"HTTP {response.status_code}")

            # Trust Content-Length only to fail fast; the streaming guard below
            # is what actually enforces the cap.
            declared = response.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise MigrationError(f"too large: {int(declared)} bytes (cap {max_bytes})")

            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > max_bytes:
                    raise MigrationError(f"too large: exceeds {max_bytes} bytes")
                chunks.append(chunk)

            body = b"".join(chunks)
    except httpx.HTTPError as exc:
        raise MigrationError(f"fetch failed: {exc}") from exc

    if not body:
        raise MigrationError("empty response body")

    content_type = sniff_content_type(body)
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise MigrationError("body is not a recognised JPEG, PNG, GIF or WebP image")

    return body, content_type


def upload_blob(
    blob_service: BlobServiceClient,
    blob_name: str,
    body: bytes,
    content_type: str,
) -> str:
    """Upload bytes to the images container and return the public blob URL."""
    blob_client = blob_service.get_blob_client(
        container=settings.azure_storage_container_images,
        blob=blob_name,
    )
    blob_client.upload_blob(
        body,
        overwrite=False,
        content_settings=ContentSettings(
            content_type=content_type,
            cache_control=CACHE_CONTROL,
        ),
    )
    return str(blob_client.url)


async def migrate_row(
    session: AsyncSession,
    client: httpx.AsyncClient,
    blob_service: BlobServiceClient,
    content_id: UUID,
    author_id: UUID,
    url: str,
    *,
    max_bytes: int,
    dry_run: bool,
    recorder: Recorder | None = None,
) -> str:
    """Migrate a single content row; returns the new blob URL."""
    body, content_type = await fetch_image(client, url, max_bytes)

    # Same layout the SAS endpoint issues, so migrated and uploaded blobs are
    # indistinguishable: uploads/{purpose}s/{user_uuid}/{file_uuid}
    blob_name = f"uploads/images/{author_id}/{uuid4()}"

    if dry_run:
        preview = f"{azure_url_prefix()}{settings.azure_storage_container_images}/{blob_name}"
        log.info(
            "DRY RUN %s: would upload %d bytes (%s) -> %s",
            content_id,
            len(body),
            content_type,
            preview,
        )
        return preview

    blob_url = await asyncio.to_thread(upload_blob, blob_service, blob_name, body, content_type)

    if len(blob_url) > IMG_MAX:
        raise MigrationError(f"blob URL exceeds column limit of {IMG_MAX} chars")

    await session.execute(update(Content).where(Content.id == content_id).values(image=blob_url))

    # Record before committing. A crash between the two leaves a row that was
    # never rewritten but is listed in the record — rolling that back is a
    # harmless no-op. The reverse order could lose the only copy of the original
    # URL, which is recoverable solely from a full database restore.
    if recorder is not None:
        recorder.write(content_id, url, blob_url)

    await session.commit()
    log.info("Migrated %s: %d bytes (%s) -> %s", content_id, len(body), content_type, blob_url)
    return blob_url


# ── Main ───────────────────────────────────────────────────────────────────────


async def run(
    *,
    dry_run: bool,
    limit: int | None,
    max_bytes: int,
    include_deleted: bool,
    record_path: Path | None = None,
) -> Report:
    report = Report()
    prefix = azure_url_prefix()

    session_maker = get_session_maker()
    blob_service = BlobServiceClient(
        account_url=f"https://{settings.azure_storage_account}.blob.core.windows.net",
        credential=settings.azure_storage_key,
    )

    # A dry run changes nothing, so there is nothing to roll back and no record
    # is opened — writing one would imply work that never happened.
    recorder = None
    if not dry_run:
        recorder = Recorder(record_path or default_record_path())
        report.record_path = recorder.path
        log.info("Recording rollback data to %s", recorder.path)

    async with session_maker() as session:
        stmt = select(Content.id, Content.author_id, Content.image).where(
            Content.image.is_not(None),
            Content.image != "",
        )
        if not include_deleted:
            stmt = stmt.where(Content.deleted_at.is_(None))
        stmt = stmt.order_by(Content.id)

        rows = (await session.execute(stmt)).all()
        log.info("Found %d content rows with an image", len(rows))

        pending = [(cid, aid, url) for cid, aid, url in rows if not url.startswith(prefix)]
        report.skipped_already_azure = len(rows) - len(pending)
        if report.skipped_already_azure:
            log.info("Skipping %d row(s) already on Azure", report.skipped_already_azure)

        if limit is not None:
            pending = pending[:limit]
            log.info("Limited to %d row(s) this run", len(pending))

        timeout = httpx.Timeout(FETCH_TIMEOUT_SECONDS)
        limits = httpx.Limits(max_connections=5)
        async with httpx.AsyncClient(
            timeout=timeout,
            limits=limits,
            follow_redirects=True,
            max_redirects=MAX_REDIRECTS,
            headers={"User-Agent": "slodi-image-migration/1.0"},
        ) as client:
            for content_id, author_id, url in pending:
                if not url.lower().startswith(("http://", "https://")):
                    report.skipped_not_http += 1
                    log.info("Skipping %s: not an HTTP(S) URL (%r)", content_id, url[:80])
                    continue
                try:
                    await migrate_row(
                        session,
                        client,
                        blob_service,
                        content_id,
                        author_id,
                        url,
                        max_bytes=max_bytes,
                        dry_run=dry_run,
                        recorder=recorder,
                    )
                    report.migrated += 1
                except MigrationError as exc:
                    await session.rollback()
                    report.fail(content_id, url, str(exc))
                except Exception as exc:  # noqa: BLE001 - one bad row must not end the run
                    await session.rollback()
                    report.fail(content_id, url, f"unexpected error: {exc!r}")

    if recorder is not None:
        recorder.close()
    await asyncio.to_thread(blob_service.close)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and validate images but write nothing to Azure or the database.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Migrate at most N rows (useful for a cautious first pass).",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=DEFAULT_MAX_BYTES,
        help=f"Reject images larger than this many bytes (default {DEFAULT_MAX_BYTES}).",
    )
    parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Also migrate soft-deleted content rows.",
    )
    parser.add_argument(
        "--record",
        type=Path,
        default=None,
        help=(
            "CSV file recording id,old_url,new_url for every rewritten row "
            "(default: ./image_migration_<UTC timestamp>.csv). Appended to if it "
            "already exists. Keep it — it is the only copy of the original URLs."
        ),
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    if args.dry_run:
        log.info("DRY RUN — no uploads, no database writes")

    report = await run(
        dry_run=args.dry_run,
        limit=args.limit,
        max_bytes=args.max_bytes,
        include_deleted=args.include_deleted,
        record_path=args.record,
    )

    log.info("─" * 60)
    log.info("Migrated:              %d", report.migrated)
    log.info("Already on Azure:      %d", report.skipped_already_azure)
    log.info("Skipped (not HTTP):    %d", report.skipped_not_http)
    log.info("Failed:                %d", len(report.failures))
    if report.record_path is not None and report.migrated:
        log.info("")
        log.info("Rollback record: %s", report.record_path.resolve())
        log.info("Keep it — it holds the only copy of the original image URLs.")
    if report.failures:
        log.info("")
        log.info("Failures (re-run after fixing, the script is idempotent):")
        for content_id, url, reason in report.failures:
            log.info("  %s  %s  — %s", content_id, url[:70], reason)


if __name__ == "__main__":
    asyncio.run(main())
