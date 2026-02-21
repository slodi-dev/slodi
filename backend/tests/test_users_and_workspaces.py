"""Tests for user CRUD and workspace management."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException, status

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


def test_get_user_not_found(client):
    with patch("app.services.users.UserService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="User not found")

        response = client.get(f"/users/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_get_workspace_not_found(client):
    with patch("app.services.workspaces.WorkspaceService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Workspace not found")

        response = client.get(f"/workspaces/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_user_returns_204(client, sample_user):
    with (
        patch("app.services.users.UserService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.users.UserService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_user
        mock_del.return_value = None

        response = client.delete(f"/users/{sample_user.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def test_delete_workspace_returns_204(client, sample_workspace):
    with patch(
        "app.services.workspaces.WorkspaceService.delete", new_callable=AsyncMock
    ) as mock_del:
        mock_del.return_value = None

        response = client.delete(f"/workspaces/{sample_workspace.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def test_list_users_empty(client):
    with (
        patch("app.services.users.UserService.list", new_callable=AsyncMock) as mock_list,
        patch("app.services.users.UserService.count", new_callable=AsyncMock) as mock_count,
    ):
        mock_list.return_value = []
        mock_count.return_value = 0

        response = client.get("/users")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []


def test_create_user_conflict_returns_409(client, sample_user_data):
    with patch("app.services.users.UserService.create", new_callable=AsyncMock) as mock_create:
        mock_create.side_effect = HTTPException(status_code=409, detail="Email already exists")

        response = client.post("/users", json=sample_user_data)
        assert response.status_code == status.HTTP_409_CONFLICT
