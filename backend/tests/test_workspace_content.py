"""Tests for workspace content: programs, groups, and tags."""

from datetime import datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import status

from app.schemas.group import GroupOut
from app.schemas.program import ProgramOut
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceNested

# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_program(workspace_id):
    return ProgramOut(
        id=uuid4(),
        workspace_id=workspace_id,
        name="Test Program",
        author_id=uuid4(),
        created_at=datetime.now(),
        author=UserOut(
            id=uuid4(), name="Test User", email="test_email@gmail.com", auth0_id="auth0|123"
        ),
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


def _make_group():
    return GroupOut(id=uuid4(), name="Test Group")


# ── Programs ──────────────────────────────────────────────────────────────────


def test_create_program(client, sample_workspace):
    author_id = uuid4()
    program_data = {"name": "Test Program", "author_id": str(author_id)}
    sample_program = _make_program(sample_workspace.id)

    with patch(
        "app.services.programs.ProgramService.create_under_workspace", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = sample_program

        response = client.post(f"/workspaces/{sample_workspace.id}/programs", json=program_data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == program_data["name"]


def test_list_workspace_programs(client, sample_workspace):
    sample_program = _make_program(sample_workspace.id)

    with (
        patch(
            "app.services.programs.ProgramService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
        patch(
            "app.services.programs.ProgramService.count_programs_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
    ):
        mock_list.return_value = [sample_program]
        mock_count.return_value = 1

        response = client.get(f"/workspaces/{sample_workspace.id}/programs")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_program.name


# ── Groups ────────────────────────────────────────────────────────────────────


def test_create_group(client):
    sample_group = _make_group()

    with patch("app.services.groups.GroupService.create", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = sample_group

        response = client.post("/groups", json={"name": "Test Group"})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == "Test Group"


def test_list_groups(client):
    sample_group = _make_group()

    with (
        patch("app.services.groups.GroupService.list", new_callable=AsyncMock) as mock_list,
        patch("app.services.groups.GroupService.count", new_callable=AsyncMock) as mock_count,
    ):
        mock_list.return_value = [sample_group]
        mock_count.return_value = 1

        response = client.get("/groups")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_group.name


def test_get_group(client):
    sample_group = _make_group()

    with patch("app.services.groups.GroupService.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = sample_group

        response = client.get(f"/groups/{sample_group.id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == sample_group.name


# ── Tags ──────────────────────────────────────────────────────────────────────


def test_list_tags(client):
    sample_tags = [
        {"id": uuid4(), "name": "Python", "description": None},
        {"id": uuid4(), "name": "FastAPI", "description": None},
    ]

    with (
        patch("app.services.tags.TagService.list", new_callable=AsyncMock) as mock_list,
        patch("app.services.tags.TagService.count", new_callable=AsyncMock) as mock_count,
    ):
        mock_list.return_value = [type("Tag", (), tag)() for tag in sample_tags]
        mock_count.return_value = 2

        response = client.get("/tags")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 2


def test_create_tag(client):
    tag_data = {"name": "Python", "description": "Python programming language"}
    sample_tag = {"id": uuid4(), "name": "Python", "description": "Python programming language"}

    with patch("app.services.tags.TagService.create", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = type("Tag", (), sample_tag)()

        response = client.post("/tags", json=tag_data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == tag_data["name"]
