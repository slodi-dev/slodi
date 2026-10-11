"""Tests for the email list router."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from app.core.db import get_session
from app.core.email import _send_batch, one_click_unsubscribe_url, unsubscribe_page_url
from app.main import create_app
from app.schemas.email_list import EmailListOut, SubscriptionStatusOut

# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_entry(email="test@example.com"):
    return EmailListOut(email=email, unsubscribe_token=uuid4())


# ── List (admin-only) ─────────────────────────────────────────────────────────


def test_list_emails_admin(client):
    entries = [_make_entry("a@example.com"), _make_entry("b@example.com")]

    with patch(
        "app.services.email_list.EmailListService.list",
        new_callable=AsyncMock,
    ) as mock_list:
        mock_list.return_value = entries

        response = client.get("/emaillist")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["email"] == "a@example.com"


# ── Subscribe (public, no auth) ───────────────────────────────────────────────


def test_subscribe_email(client):
    with patch(
        "app.services.email_list.EmailListService.create",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = None

        response = client.post("/emaillist", json={"email": "subscriber@example.com"})
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_create.assert_called_once()


def test_subscribe_email_duplicate_is_idempotent(client):
    """Subscribing an already-subscribed email does not raise an error."""
    with patch(
        "app.services.email_list.EmailListService.create",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = None

        response = client.post("/emaillist", json={"email": "existing@example.com"})
        assert response.status_code == status.HTTP_202_ACCEPTED


def test_subscribe_invalid_email_rejected(client):
    response = client.post("/emaillist", json={"email": "not-an-email"})
    assert response.status_code == 422


# ── Unsubscribe by token (public) ─────────────────────────────────────────────


@pytest.fixture
def anon_client(mock_db_session):
    """Client with no authenticated user, as a mail provider's POST would be."""
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    app.dependency_overrides[get_session] = override_get_session
    return TestClient(app)


SVC = "app.services.email_list.EmailListService"


def test_get_unsubscribe_token_only_checks_it(anon_client):
    """GET must not unsubscribe: link scanners and previewers fetch email links."""
    token = uuid4()

    with (
        patch(f"{SVC}.subscription_status", new_callable=AsyncMock) as mock_check,
        patch(f"{SVC}.unsubscribe_by_token", new_callable=AsyncMock) as mock_unsub,
    ):
        mock_check.return_value = SubscriptionStatusOut(subscribed=True, changed=False)
        response = anon_client.get(f"/emaillist/unsubscribe/{token}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"subscribed": True, "changed": False}
    mock_check.assert_called_once_with(token)
    mock_unsub.assert_not_called()


def test_get_unsubscribe_reports_an_address_that_already_left(anon_client):
    with patch(f"{SVC}.subscription_status", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = SubscriptionStatusOut(subscribed=False, changed=False)
        response = anon_client.get(f"/emaillist/unsubscribe/{uuid4()}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["subscribed"] is False


def test_get_unsubscribe_invalid_token_returns_404(anon_client):
    with patch(f"{SVC}.subscription_status", new_callable=AsyncMock) as mock_check:
        mock_check.side_effect = HTTPException(status_code=404, detail="Token not found")

        response = anon_client.get(f"/emaillist/unsubscribe/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.parametrize("changed", [True, False])
def test_one_click_post_returns_200_whether_or_not_already_unsubscribed(anon_client, changed):
    """RFC 8058: the provider POSTs List-Unsubscribe=One-Click, no credentials.
    A retry, or a second click, is not an error."""
    token = uuid4()

    with patch(f"{SVC}.unsubscribe_by_token", new_callable=AsyncMock) as mock_unsub:
        mock_unsub.return_value = SubscriptionStatusOut(subscribed=False, changed=changed)
        response = anon_client.post(
            f"/emaillist/unsubscribe/{token}",
            content="List-Unsubscribe=One-Click",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"subscribed": False, "changed": changed}
    mock_unsub.assert_called_once_with(token)


def test_post_unsubscribe_without_body(anon_client):
    """The unsubscribe page's confirm button posts with no body."""
    token = uuid4()

    with patch(f"{SVC}.unsubscribe_by_token", new_callable=AsyncMock) as mock_unsub:
        mock_unsub.return_value = SubscriptionStatusOut(subscribed=False, changed=True)
        response = anon_client.post(f"/emaillist/unsubscribe/{token}")

    assert response.status_code == status.HTTP_200_OK
    mock_unsub.assert_called_once_with(token)


def test_post_unsubscribe_invalid_token_returns_404(anon_client):
    with patch(f"{SVC}.unsubscribe_by_token", new_callable=AsyncMock) as mock_unsub:
        mock_unsub.side_effect = HTTPException(status_code=404, detail="Token not found")

        response = anon_client.post(f"/emaillist/unsubscribe/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_resubscribe_is_a_public_post(anon_client):
    token = uuid4()
    with patch(f"{SVC}.resubscribe_by_token", new_callable=AsyncMock) as mock_resub:
        mock_resub.return_value = SubscriptionStatusOut(subscribed=True, changed=True)
        response = anon_client.post(f"/emaillist/resubscribe/{token}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"subscribed": True, "changed": True}
    mock_resub.assert_called_once_with(token)


def test_resubscribe_cannot_be_triggered_by_a_get(anon_client):
    """A prefetched link must never change a subscription, in either direction."""
    assert anon_client.get(f"/emaillist/resubscribe/{uuid4()}").status_code == 405


def test_post_unsubscribe_malformed_token_rejected(anon_client):
    response = anon_client.post("/emaillist/unsubscribe/not-a-uuid")
    assert response.status_code == 422


def test_delete_by_email_requires_auth(anon_client):
    """Unsubscribing by bare email address stays admin-only."""
    response = anon_client.delete("/emaillist/someone@example.com")
    assert response.status_code in (401, 403)


# ── Unsubscribe links in outgoing email ───────────────────────────────────────


def test_unsubscribe_urls_point_at_page_and_api():
    token = uuid4()
    with (
        patch("app.core.email.settings.public_site_url", "https://site.test/"),
        patch("app.core.email.settings.public_api_url", "https://api.test"),
    ):
        assert unsubscribe_page_url(token) == f"https://site.test/unsubscribe?token={token}"
        assert one_click_unsubscribe_url(token) == f"https://api.test/emaillist/unsubscribe/{token}"


def test_batch_sets_one_click_headers_to_backend_url():
    token = uuid4()
    one_click = one_click_unsubscribe_url(token)

    with (
        patch("app.core.email.settings.resend_api_key", "test-key"),
        patch("app.core.email.resend.Batch.send") as mock_send,
    ):
        _send_batch(
            [
                ("a@example.com", "Subject", "<p>hi</p>", one_click),
                ("b@example.com", "Subject", "<p>hi</p>", None),
            ]
        )

    params = mock_send.call_args.args[0]
    assert params[0]["headers"] == {
        "List-Unsubscribe": f"<{one_click}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
    assert "headers" not in params[1]


def test_broadcast_links_body_to_page_and_header_to_api(client):
    entry = _make_entry("sub@example.com")

    with (
        patch(
            "app.services.email_list.EmailListService.list",
            new_callable=AsyncMock,
            return_value=[entry],
        ),
        patch("app.routers.email_router.send_batch_background") as mock_send,
    ):
        response = client.post(
            "/emails/broadcast",
            json={"subject": "Fréttir", "html": '<a href="{unsubscribe_url}">Afskrá</a>'},
        )

    assert response.status_code == status.HTTP_202_ACCEPTED
    messages = mock_send.call_args.args[1]
    recipient, _subject, html, header_url = messages[0]
    assert recipient == "sub@example.com"
    assert unsubscribe_page_url(entry.unsubscribe_token) in html
    assert header_url == one_click_unsubscribe_url(entry.unsubscribe_token)


# ── Delete (admin-only) ───────────────────────────────────────────────────────


def test_delete_email_admin(client):
    with patch(
        "app.services.email_list.EmailListService.delete",
        new_callable=AsyncMock,
    ) as mock_delete:
        mock_delete.return_value = None

        response = client.delete("/emaillist/someone@example.com")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_delete.assert_called_once_with("someone@example.com")


def test_delete_email_not_found(client):
    with patch(
        "app.services.email_list.EmailListService.delete",
        new_callable=AsyncMock,
    ) as mock_delete:
        mock_delete.side_effect = HTTPException(status_code=404, detail="Email not found")

        response = client.delete("/emaillist/missing@example.com")
        assert response.status_code == status.HTTP_404_NOT_FOUND
