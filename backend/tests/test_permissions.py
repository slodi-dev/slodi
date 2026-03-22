"""Tests for permission enforcement on admin-only endpoints."""

from unittest.mock import AsyncMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.main import create_app


@pytest.fixture
def viewer_client(mock_db_session, viewer_user):
    """Test client authenticated as a viewer (non-admin) user."""
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    async def override_get_current_user():
        return viewer_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


# ── Platform admin permission checks ─────────────────────────────────────────


def test_viewer_cannot_create_user(viewer_client):
    response = viewer_client.post(
        "/users",
        json={"auth0_id": "auth0|123", "email": "new@example.com", "name": "New User"},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_viewer_cannot_list_admin_users(viewer_client):
    response = viewer_client.get("/users/admin/list")
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_viewer_cannot_send_email(viewer_client):
    response = viewer_client.post(
        "/emails/send",
        json={
            "recipients": ["someone@example.com"],
            "subject": "Hello",
            "html": "<p>Hi</p>",
        },
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_viewer_cannot_broadcast(viewer_client):
    response = viewer_client.post(
        "/emails/broadcast",
        json={"subject": "Newsletter", "html": "<p>Content</p>"},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_viewer_cannot_list_emaillist(viewer_client):
    response = viewer_client.get("/emaillist")
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_viewer_cannot_delete_emaillist_entry(viewer_client):
    response = viewer_client.delete("/emaillist/someone@example.com")
    assert response.status_code == status.HTTP_403_FORBIDDEN


# ── Admin user has access ─────────────────────────────────────────────────────


def test_admin_can_list_emaillist(client):
    from unittest.mock import patch

    with patch(
        "app.services.email_list.EmailListService.list",
        new_callable=AsyncMock,
    ) as mock_list:
        mock_list.return_value = []

        response = client.get("/emaillist")
        assert response.status_code == status.HTTP_200_OK


def test_admin_can_list_admin_users(client):
    from unittest.mock import patch

    with (
        patch(
            "app.services.users.UserService.count",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.users.UserService.list_full",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 0
        mock_list.return_value = []

        response = client.get("/users/admin/list")
        assert response.status_code == status.HTTP_200_OK
