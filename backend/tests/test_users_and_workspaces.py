"""Tests for user CRUD and workspace management."""

from unittest.mock import AsyncMock, patch

from fastapi import status

# ── Users ─────────────────────────────────────────────────────────────────────


def test_create_user(client, sample_user_data, sample_user):
    with patch("app.services.users.UserService.create", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = sample_user

        response = client.post("/users", json=sample_user_data)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == sample_user_data["email"]
        assert data["name"] == sample_user_data["name"]


def test_get_user(client, sample_user):
    with patch("app.services.users.UserService.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = sample_user

        response = client.get(f"/users/{sample_user.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == sample_user.email
        assert data["name"] == sample_user.name


def test_list_users(client, sample_user):
    with (
        patch("app.services.users.UserService.list", new_callable=AsyncMock) as mock_list,
        patch("app.services.users.UserService.count", new_callable=AsyncMock) as mock_count,
    ):
        mock_list.return_value = [sample_user]
        mock_count.return_value = 1

        response = client.get("/users")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["email"] == sample_user.email


# ── Workspaces ────────────────────────────────────────────────────────────────


def test_create_workspace(client, sample_user, sample_workspace_data, sample_workspace):
    with patch(
        "app.services.workspaces.WorkspaceService.create_user_workspace", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = sample_workspace

        response = client.post(f"/users/{sample_user.id}/workspaces", json=sample_workspace_data)
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

        response = client.get(f"/users/{sample_user.id}/workspaces")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_workspace.name


def test_get_workspace(client, sample_workspace):
    with patch("app.services.workspaces.WorkspaceService.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = sample_workspace

        response = client.get(f"/workspaces/{sample_workspace.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == sample_workspace.name
