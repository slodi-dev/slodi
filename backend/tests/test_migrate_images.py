"""Tests for the one-off Azure image migration script.

Network calls are served by an ``httpx.MockTransport``, so the unit tests run
offline; they pin down the validation that decides whether a remote file is
allowed to land in the public images container at all. The integration test at
the bottom runs ``run()`` against a real Postgres container to verify which rows
the migration selects — the soft-delete filter and the already-migrated skip are
the parts where a mistake would either corrupt live data or redo finished work.
"""

from __future__ import annotations

import csv
import datetime as dt
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import update

import scripts.migrate_images_to_azure as script
from app import models as m
from app.utils import get_current_datetime
from scripts.migrate_images_to_azure import (
    MigrationError,
    assert_public_url,
    fetch_image,
    sniff_content_type,
)

PNG = b"\x89PNG\r\n\x1a\n" + b"payload"
JPEG = b"\xff\xd8\xff\xe0" + b"payload"
GIF = b"GIF89a" + b"payload"
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"payload"


# ---------------------------------------------------------------------------
# sniff_content_type
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        (PNG, "image/png"),
        (JPEG, "image/jpeg"),
        (GIF, "image/gif"),
        (b"GIF87a" + b"payload", "image/gif"),
        (WEBP, "image/webp"),
    ],
)
def test_sniff_recognises_allowed_image_signatures(body: bytes, expected: str) -> None:
    assert sniff_content_type(body) == expected


@pytest.mark.parametrize(
    "body",
    [
        b"<html><body>not an image</body></html>",
        b"%PDF-1.7 not an image either",
        b"",
        b"RIFF\x00\x00\x00\x00AVI LIST",  # RIFF container, but not WebP
    ],
)
def test_sniff_rejects_non_images(body: bytes) -> None:
    assert sniff_content_type(body) == ""


# ---------------------------------------------------------------------------
# assert_public_url — SSRF guard
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/x.png",
        "http://localhost/x.png",
        "http://169.254.169.254/latest/meta-data/",  # cloud metadata endpoint
        "http://10.0.0.5/x.png",
        "http://192.168.1.1/x.png",
        "http://[::1]/x.png",
    ],
)
def test_assert_public_url_blocks_internal_addresses(url: str) -> None:
    with pytest.raises(MigrationError):
        assert_public_url(url)


@pytest.mark.parametrize("url", ["ftp://example.com/x.png", "file:///etc/passwd", "/relative.png"])
def test_assert_public_url_blocks_non_http_schemes(url: str) -> None:
    with pytest.raises(MigrationError):
        assert_public_url(url)


# ---------------------------------------------------------------------------
# fetch_image
# ---------------------------------------------------------------------------


def _client(handler: object) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))  # type: ignore[arg-type]


@pytest.fixture(autouse=True)
def _skip_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    """The mock transport never opens a socket, so skip the DNS-based guard."""
    monkeypatch.setattr("scripts.migrate_images_to_azure.assert_public_url", lambda url: None)


@pytest.mark.asyncio
async def test_fetch_image_returns_body_and_sniffed_type() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        # Deliberately mislabelled: the sniffed type must win.
        return httpx.Response(200, content=PNG, headers={"content-type": "application/json"})

    async with _client(handler) as client:
        body, content_type = await fetch_image(client, "https://cdn.test/a.png", 1_000_000)

    assert body == PNG
    assert content_type == "image/png"


@pytest.mark.asyncio
async def test_fetch_image_rejects_html_served_as_an_image() -> None:
    """A mislabelled HTML file must not be re-hosted in the public container."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"<html><script>alert(1)</script></html>",
            headers={"content-type": "image/png"},
        )

    async with _client(handler) as client:
        with pytest.raises(MigrationError, match="not a recognised"):
            await fetch_image(client, "https://cdn.test/evil.png", 1_000_000)


@pytest.mark.asyncio
async def test_fetch_image_enforces_size_cap_while_streaming() -> None:
    """The cap holds even when the server declares no Content-Length."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            stream=httpx.ByteStream(PNG + b"x" * 5_000),
            headers={"content-type": "image/png"},
        )

    async with _client(handler) as client:
        with pytest.raises(MigrationError, match="too large"):
            await fetch_image(client, "https://cdn.test/big.png", 1_000)


@pytest.mark.asyncio
async def test_fetch_image_rejects_oversized_content_length_early() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=PNG,
            headers={"content-type": "image/png", "content-length": "999999"},
        )

    async with _client(handler) as client:
        with pytest.raises(MigrationError, match="too large"):
            await fetch_image(client, "https://cdn.test/big.png", 1_000)


@pytest.mark.asyncio
async def test_fetch_image_rejects_error_status() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    async with _client(handler) as client:
        with pytest.raises(MigrationError, match="HTTP 404"):
            await fetch_image(client, "https://cdn.test/gone.png", 1_000_000)


@pytest.mark.asyncio
async def test_fetch_image_rejects_empty_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"", headers={"content-type": "image/png"})

    async with _client(handler) as client:
        with pytest.raises(MigrationError, match="empty"):
            await fetch_image(client, "https://cdn.test/empty.png", 1_000_000)


# ---------------------------------------------------------------------------
# Recorder — rollback record
# ---------------------------------------------------------------------------


def test_recorder_writes_header_and_rows(tmp_path: Path) -> None:
    path = tmp_path / "rec.csv"
    rec = script.Recorder(path)
    cid = uuid4()
    rec.write(cid, "https://old.example/a.png", "https://new.example/b.png")
    rec.close()

    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    assert len(rows) == 1
    assert rows[0]["content_id"] == str(cid)
    assert rows[0]["old_url"] == "https://old.example/a.png"
    assert rows[0]["new_url"] == "https://new.example/b.png"


def test_recorder_flushes_each_row_so_a_killed_run_keeps_its_record(tmp_path: Path) -> None:
    """The record must survive a process that never closes the file."""
    path = tmp_path / "rec.csv"
    rec = script.Recorder(path)
    rec.write(uuid4(), "https://old.example/a.png", "https://new.example/b.png")
    # Deliberately no close() — simulate SIGKILL mid-run.
    assert len(list(csv.DictReader(path.open(encoding="utf-8")))) == 1


def test_recorder_appends_to_an_existing_file_without_a_second_header(tmp_path: Path) -> None:
    """Re-running against the same --record path must not lose earlier rows."""
    path = tmp_path / "rec.csv"
    first = script.Recorder(path)
    first.write(uuid4(), "https://old.example/1.png", "https://new.example/1.png")
    first.close()

    second = script.Recorder(path)
    second.write(uuid4(), "https://old.example/2.png", "https://new.example/2.png")
    second.close()

    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    assert [r["old_url"] for r in rows] == [
        "https://old.example/1.png",
        "https://old.example/2.png",
    ]
    assert path.read_text().count("content_id") == 1


def test_recorder_quotes_urls_containing_commas(tmp_path: Path) -> None:
    """A comma in a query string must not shift the columns."""
    path = tmp_path / "rec.csv"
    rec = script.Recorder(path)
    tricky = "https://old.example/a.png?sizes=1,2,3&name=x"
    rec.write(uuid4(), tricky, "https://new.example/b.png")
    rec.close()

    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    assert rows[0]["old_url"] == tricky
    assert rows[0]["new_url"] == "https://new.example/b.png"


# ---------------------------------------------------------------------------
# run() row selection — integration, real Postgres
# ---------------------------------------------------------------------------


class _FakeSessionMaker:
    """Hands ``run()`` the test's savepoint-backed session instead of a new engine."""

    def __init__(self, session: object) -> None:
        self._session = session

    def __call__(self) -> _FakeSessionMaker:
        return self

    async def __aenter__(self) -> object:
        return self._session

    async def __aexit__(self, *exc: object) -> bool:
        return False


@pytest.mark.integration
@pytest.mark.asyncio
async def test_run_selects_only_unmigrated_live_rows(
    db, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Only live, non-Azure, HTTP image rows are picked up — and are rewritten."""
    user = m.User(name="Mig User", auth0_id=f"auth0|{uuid4()}", email=f"{uuid4()}@test.com")
    ws = m.Workspace(
        name="Mig WS",
        default_meeting_weekday=m.Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=m.EventInterval.weekly,
        season_start=dt.date.today(),
    )
    db.add_all([user, ws])
    await db.flush()

    azure_url = f"{script.azure_url_prefix()}images/uploads/images/{user.id}/{uuid4()}"

    def _program(name: str, image: str | None, deleted: bool = False) -> m.Program:
        return m.Program(
            name=name,
            created_at=get_current_datetime(),
            author_id=user.id,
            workspace_id=ws.id,
            content_type=m.ContentType.program,
            image=image,
            deleted_at=get_current_datetime() if deleted else None,
        )

    external = _program("external", "https://cdn.example.com/a.png")
    already = _program("already", azure_url)
    no_image = _program("no-image", None)
    blank = _program("blank", "")
    not_http = _program("not-http", "data:image/png;base64,AAAA")
    deleted = _program("deleted", "https://cdn.example.com/gone.png", deleted=True)
    db.add_all([external, already, no_image, blank, not_http, deleted])
    await db.flush()

    monkeypatch.setattr(script, "get_session_maker", lambda: _FakeSessionMaker(db))
    monkeypatch.setattr(script, "BlobServiceClient", lambda **kwargs: _FakeBlobService())

    fetched: list[str] = []

    async def fake_fetch(client: object, url: str, max_bytes: int) -> tuple[bytes, str]:
        fetched.append(url)
        return PNG, "image/png"

    monkeypatch.setattr(script, "fetch_image", fake_fetch)

    uploaded: list[str] = []

    def fake_upload(svc: object, blob_name: str, body: bytes, content_type: str) -> str:
        uploaded.append(blob_name)
        return f"{script.azure_url_prefix()}images/{blob_name}"

    monkeypatch.setattr(script, "upload_blob", fake_upload)

    record_path = tmp_path / "record.csv"
    report = await script.run(
        dry_run=False,
        limit=None,
        max_bytes=1_000_000,
        include_deleted=False,
        record_path=record_path,
    )

    # Soft-deleted, empty, and NULL images are never selected; the Azure row is
    # counted as already-migrated; the data: URL is skipped as non-HTTP.
    assert fetched == ["https://cdn.example.com/a.png"]
    assert report.migrated == 1
    assert report.skipped_already_azure == 1
    assert report.skipped_not_http == 1
    assert report.failures == []

    # The blob name matches the layout the SAS endpoint issues.
    assert len(uploaded) == 1
    assert uploaded[0].startswith(f"uploads/images/{user.id}/")

    await db.refresh(external)
    await db.refresh(already)
    assert external.image is not None
    assert external.image.startswith(script.azure_url_prefix())
    assert already.image == azure_url  # untouched — idempotent

    # The rollback record holds the original URL — the only copy once the row is
    # overwritten — and exactly one line per rewritten row.
    assert report.record_path == record_path
    rows = list(csv.DictReader(record_path.open(encoding="utf-8")))
    assert len(rows) == 1
    assert rows[0]["content_id"] == str(external.id)
    assert rows[0]["old_url"] == "https://cdn.example.com/a.png"
    assert rows[0]["new_url"] == external.image
    assert rows[0]["migrated_at"]

    # Rolling back is a plain UPDATE driven by that file.
    await db.execute(
        update(m.Content).where(m.Content.id == external.id).values(image=rows[0]["old_url"])
    )
    await db.refresh(external)
    assert external.image == "https://cdn.example.com/a.png"


class _FakeBlobService:
    def close(self) -> None:
        return None
