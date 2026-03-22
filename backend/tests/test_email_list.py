"""Tests for the email list router."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.email_list import EmailListOut

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


def test_unsubscribe_by_token(client):
    token = uuid4()

    with patch(
        "app.services.email_list.EmailListService.unsubscribe_by_token",
        new_callable=AsyncMock,
    ) as mock_unsub:
        mock_unsub.return_value = None

        response = client.get(f"/emaillist/unsubscribe/{token}")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_unsub.assert_called_once_with(token)


def test_unsubscribe_invalid_token_returns_404(client):
    token = uuid4()

    with patch(
        "app.services.email_list.EmailListService.unsubscribe_by_token",
        new_callable=AsyncMock,
    ) as mock_unsub:
        mock_unsub.side_effect = HTTPException(status_code=404, detail="Token not found")

        response = client.get(f"/emaillist/unsubscribe/{token}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


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
