"""Unit tests for the upload SAS service and endpoints — no DB or network.

The Azure SAS tokens are generated locally by ``azure-storage-blob`` (pure
crypto over the configured account key), so these run fully offline.
"""

from __future__ import annotations

import datetime as dt
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.db import get_session
from app.domain.upload_constraints import SAS_TTL_MINUTES
from app.main import create_app
from app.services.uploads import UploadService, _safe_content_disposition
from app.settings import settings


def _query(url: str) -> dict[str, list[str]]:
    return parse_qs(urlsplit(url).query)


def _prefix(container: str) -> str:
    return f"https://{settings.azure_storage_account}.blob.core.windows.net/{container}/"


def _image_prefix() -> str:
    return _prefix(settings.azure_storage_container_images)


def _document_prefix() -> str:
    return _prefix(settings.azure_storage_container_documents)


# ---------------------------------------------------------------------------
# UploadService.create_sas
# ---------------------------------------------------------------------------


def test_create_sas_returns_write_only_https_token():
    user_id = uuid4()
    res = UploadService().create_sas(user_id=user_id, purpose="image", content_type="image/png")

    q = _query(res.upload_url)
    assert q["sp"][0] == "cw", "write-only: create + write, no read"
    assert q["spr"] == ["https"], "token must be HTTPS-only"
    assert "sig" in q


def test_create_sas_blob_name_is_namespaced_and_uuid():
    user_id = uuid4()
    res = UploadService().create_sas(
        user_id=user_id, purpose="document", content_type="application/pdf"
    )

    expected = f"{_document_prefix()}uploads/documents/{user_id}/"
    assert res.blob_url.startswith(expected)
    # Trailing path segment is a fresh UUID (parseable), no client input.
    file_part = res.blob_url.rsplit("/", 1)[-1]
    assert str(__import__("uuid").UUID(file_part)) == file_part


def test_create_sas_clean_blob_url_has_no_token():
    res = UploadService().create_sas(user_id=uuid4(), purpose="image", content_type="image/png")
    assert "?" not in res.blob_url
    assert "sig" not in res.blob_url


def test_create_sas_routes_purpose_to_its_container():
    img = UploadService().create_sas(user_id=uuid4(), purpose="image", content_type="image/png")
    doc = UploadService().create_sas(
        user_id=uuid4(), purpose="document", content_type="application/pdf"
    )
    assert img.blob_url.startswith(f"{_image_prefix()}uploads/images/")
    assert doc.blob_url.startswith(f"{_document_prefix()}uploads/documents/")


def test_create_sas_expiry_is_15_minutes():
    before = dt.datetime.now(dt.timezone.utc)
    res = UploadService().create_sas(user_id=uuid4(), purpose="image", content_type="image/jpeg")
    delta = res.expires_at - before
    assert (
        dt.timedelta(minutes=SAS_TTL_MINUTES)
        <= delta
        < dt.timedelta(minutes=SAS_TTL_MINUTES, seconds=10)
    )


def test_create_sas_normalizes_content_type_parameters():
    # A charset suffix must not defeat the allowlist match.
    res = UploadService().create_sas(
        user_id=uuid4(), purpose="image", content_type="IMAGE/PNG; charset=utf-8"
    )
    assert res.upload_url


@pytest.mark.parametrize(
    ("purpose", "content_type"),
    [
        ("image", "image/svg+xml"),  # SVG deliberately excluded (script vector)
        ("image", "text/html"),
        ("image", "application/pdf"),  # right type, wrong purpose
        ("document", "image/png"),
        ("document", "application/x-msdownload"),
    ],
)
def test_create_sas_rejects_disallowed_content_type(purpose, content_type):
    with pytest.raises(HTTPException) as exc:
        UploadService().create_sas(user_id=uuid4(), purpose=purpose, content_type=content_type)
    assert exc.value.status_code == 415


def test_create_sas_rejects_unknown_purpose():
    with pytest.raises(HTTPException) as exc:
        UploadService().create_sas(
            user_id=uuid4(),
            purpose="video",
            content_type="video/mp4",  # type: ignore[arg-type]
        )
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# UploadService.create_download_sas
# ---------------------------------------------------------------------------


def _valid_blob_name() -> str:
    return f"uploads/documents/{uuid4()}/{uuid4()}"


def test_create_download_sas_is_read_only_https_attachment():
    res = UploadService().create_download_sas(blob_name=_valid_blob_name())

    assert res.download_url.startswith(_document_prefix()), "downloads come from private container"
    q = _query(res.download_url)
    assert q["sp"][0] == "r", "download SAS must be read-only"
    assert q["spr"] == ["https"]
    assert q["rscd"][0] == "attachment", "must force download, never inline render"


def test_create_download_sas_expiry_is_15_minutes():
    before = dt.datetime.now(dt.timezone.utc)
    res = UploadService().create_download_sas(blob_name=_valid_blob_name())
    delta = res.expires_at - before
    assert (
        dt.timedelta(minutes=SAS_TTL_MINUTES)
        <= delta
        < dt.timedelta(minutes=SAS_TTL_MINUTES, seconds=10)
    )


def test_create_download_sas_encodes_icelandic_filename():
    res = UploadService().create_download_sas(
        blob_name=_valid_blob_name(), filename="Þórðarbók.pdf"
    )
    rscd = _query(res.download_url)["rscd"][0]
    assert rscd.startswith("attachment")
    # RFC 5987 UTF-8 form carries the original Icelandic characters.
    assert "filename*=UTF-8''" in rscd
    assert "%C3%9E" in rscd  # percent-encoded 'Þ'


@pytest.mark.parametrize(
    "bad_name",
    [
        "secrets/key.txt",
        "uploads/images/../../etc/passwd",
        "uploads/documents/x/y",  # not UUIDs
        "uploads/videos/{u}/{u}".format(u=uuid4()),  # disallowed purpose folder
        "uploads/images/{u}/{u}".format(u=uuid4()),  # images are public, not downloadable
        "../uploads/documents/{u}/{u}".format(u=uuid4()),
        "",
    ],
)
def test_create_download_sas_rejects_invalid_blob_name(bad_name):
    with pytest.raises(HTTPException) as exc:
        UploadService().create_download_sas(blob_name=bad_name)
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# _safe_content_disposition (header-injection hardening)
# ---------------------------------------------------------------------------


def test_safe_content_disposition_without_filename():
    assert _safe_content_disposition(None) == "attachment"
    assert _safe_content_disposition("   ") == "attachment"


def test_safe_content_disposition_strips_crlf_and_quotes():
    out = _safe_content_disposition('eyik"\r\nSet-Cookie: x=1.pdf')
    assert "\r" not in out and "\n" not in out
    # No raw double-quote escapes the quoted ascii fallback.
    assert out.count('"') == 2


def test_safe_content_disposition_drops_path_components():
    out = _safe_content_disposition("../../etc/passwd")
    assert "/" not in out.split("filename*=")[0]


# ---------------------------------------------------------------------------
# Endpoint tests (auth via the `client` fixture's admin override)
# ---------------------------------------------------------------------------


def test_post_sas_returns_urls(client):
    resp = client.post("/uploads/sas", json={"content_type": "image/png", "purpose": "image"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["blob_url"].startswith(_image_prefix())
    assert "sig" in body["upload_url"]


def test_post_sas_rejects_disallowed_type(client):
    resp = client.post("/uploads/sas", json={"content_type": "image/svg+xml", "purpose": "image"})
    assert resp.status_code == 415


def test_post_sas_rejects_invalid_purpose(client):
    resp = client.post("/uploads/sas", json={"content_type": "video/mp4", "purpose": "video"})
    assert resp.status_code == 422  # Literal validation


def test_post_download_sas_returns_attachment_url(client):
    resp = client.post("/uploads/sas/download", json={"blob_name": _valid_blob_name()})
    assert resp.status_code == 200
    assert "rscd=attachment" in resp.json()["download_url"]


def test_post_download_sas_rejects_bad_blob_name(client):
    resp = client.post("/uploads/sas/download", json={"blob_name": "secrets/key.txt"})
    assert resp.status_code == 400


def test_upload_endpoints_require_auth(mock_db_session):
    """Without the auth override, a missing bearer token is rejected."""
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    app.dependency_overrides[get_session] = override_get_session
    unauth = TestClient(app)

    resp = unauth.post("/uploads/sas", json={"content_type": "image/png", "purpose": "image"})
    assert resp.status_code in (401, 403)
