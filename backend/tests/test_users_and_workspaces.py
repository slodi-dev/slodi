"""Tests for user CRUD and workspace management."""

from unittest.mock import AsyncMock, patch

from fastapi import status

from app.domain.enums import Permissions

# ── Users ─────────────────────────────────────────────────────────────────────


# ── Workspaces ────────────────────────────────────────────────────────────────


def test_create_workspace(client, sample_user, sample_workspace_data, sample_workspace):
    with patch(
        "app.services.workspaces.WorkspaceService.create_user_workspace", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = sample_workspace

        response = client.post("/users/me/workspaces", json=sample_workspace_data)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == sample_workspace_data["name"]


def test_list_user_workspaces(client, sample_user, sample_workspace):
    with (
        patch(
            "app.services.workspaces.WorkspaceService.list_user_workspaces",
            new_callable=AsyncMock,
        ) as mock_list,
        patch(
            "app.services.workspaces.WorkspaceService.count_user_workspaces",
            new_callable=AsyncMock,
        ) as mock_count,
    ):
        mock_list.return_value = [sample_workspace]
        mock_count.return_value = 1

        response = client.get("/users/me/workspaces")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_workspace.name


def test_delete_user_returns_204(client, sample_user):
    with (
        patch("app.services.users.UserService.get_full", new_callable=AsyncMock) as mock_get_full,
        patch("app.services.users.UserService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get_full.return_value = sample_user
        mock_del.return_value = None

        response = client.delete(f"/users/{sample_user.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def test_an_admin_cannot_delete_another_admin(client, sample_user):
    other_admin = sample_user.model_copy(update={"permissions": Permissions.admin})
    with (
        patch("app.services.users.UserService.get_full", new_callable=AsyncMock) as get_full,
        patch("app.services.users.UserService.delete", new_callable=AsyncMock) as delete,
    ):
        get_full.return_value = other_admin
        response = client.delete(f"/users/{other_admin.id}")
    assert response.status_code == status.HTTP_403_FORBIDDEN
    delete.assert_not_awaited()


def test_an_admin_can_change_only_someones_permission(client, sample_user):
    """Not their email or auth0_id: either is a way to take over an account."""
    response = client.patch(
        f"/users/{sample_user.id}", json={"email": "x@example.com", "auth0_id": "auth0|x"}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
