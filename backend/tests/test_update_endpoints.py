"""Tests for PATCH (update) endpoints across all major routers."""

from datetime import datetime as dt
from datetime import timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import status

from app.schemas.comment import CommentOut
from app.schemas.group import GroupOut
from app.schemas.program import ProgramOut
from app.schemas.tag import TagOut
from app.schemas.user import UserOut, UserOutLimited
from app.schemas.workspace import WorkspaceNested, WorkspaceOut

# ── Helpers ───────────────────────────────────────────────────────────────────

_NOW = dt(2025, 6, 1, 10, 0, tzinfo=timezone.utc)


def _make_program(workspace_id, name="Test Program"):
    author_id = uuid4()
    return ProgramOut(
        id=uuid4(),
        workspace_id=workspace_id,
        name=name,
        author_id=author_id,
        author_name="Test User",
        created_at=_NOW,
        author=UserOutLimited(id=author_id, name="Test User"),
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


# ── Program update ────────────────────────────────────────────────────────────


def test_update_program(client, sample_workspace):
    program = _make_program(sample_workspace.id)
    updated = _make_program(sample_workspace.id, name="Updated Program")
    updated = updated.model_copy(update={"id": program.id})

    with (
        patch(
            "app.services.programs.ProgramService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.programs.ProgramService.update",
            new_callable=AsyncMock,
        ) as mock_update,
    ):
        mock_get.return_value = program
        mock_update.return_value = updated

        response = client.patch(f"/programs/{program.id}", json={"name": "Updated Program"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Updated Program"


def test_update_program_not_found(client):
    from fastapi import HTTPException

    with patch(
        "app.services.programs.ProgramService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Program not found")

        response = client.patch(f"/programs/{uuid4()}", json={"name": "X"})
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Workspace update ──────────────────────────────────────────────────────────


def test_update_workspace(client, sample_workspace):
    updated = WorkspaceOut(
        id=sample_workspace.id,
        name="Updated Workspace",
    )

    with patch(
        "app.services.workspaces.WorkspaceService.update",
        new_callable=AsyncMock,
    ) as mock_update:
        mock_update.return_value = updated

        response = client.patch(
            f"/workspaces/{sample_workspace.id}",
            json={"name": "Updated Workspace"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Updated Workspace"


def test_update_workspace_not_found(client):
    from fastapi import HTTPException

    with patch(
        "app.services.workspaces.WorkspaceService.update",
        new_callable=AsyncMock,
    ) as mock_update:
        mock_update.side_effect = HTTPException(status_code=404, detail="Workspace not found")

        response = client.patch(f"/workspaces/{uuid4()}", json={"name": "X"})
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Group update ──────────────────────────────────────────────────────────────


def test_update_group(client):
    group = GroupOut(id=uuid4(), name="Test Group")
    updated = GroupOut(id=group.id, name="Updated Group")

    with patch(
        "app.services.groups.GroupService.update",
        new_callable=AsyncMock,
    ) as mock_update:
        mock_update.return_value = updated

        response = client.patch(f"/groups/{group.id}", json={"name": "Updated Group"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Updated Group"


# ── Tag update ────────────────────────────────────────────────────────────────


def test_update_tag(client):
    tag = TagOut(id=uuid4(), name="oldtag")
    updated = TagOut(id=tag.id, name="newtag")

    with patch(
        "app.services.tags.TagService.update",
        new_callable=AsyncMock,
    ) as mock_update:
        mock_update.return_value = updated

        response = client.patch(f"/tags/{tag.id}", json={"name": "newtag"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "newtag"


# ── Comment update (admin endpoint) ──────────────────────────────────────────


def test_update_comment_admin(client):
    comment = CommentOut(
        id=uuid4(),
        body="Original body",
        user_id=uuid4(),
        content_id=uuid4(),
        created_at=_NOW,
    )
    updated = comment.model_copy(update={"body": "Updated body"})

    with patch(
        "app.services.comments.CommentService.update",
        new_callable=AsyncMock,
    ) as mock_update:
        mock_update.return_value = updated

        response = client.patch(
            f"/admin/comments/{comment.id}",
            json={"body": "Updated body"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["body"] == "Updated body"


# ── User /me update ───────────────────────────────────────────────────────────


def test_update_user_me(client, admin_user):
    updated = UserOut(
        id=admin_user.id,
        auth0_id=admin_user.auth0_id,
        email=admin_user.email,
        name="New Name",
        pronouns=None,
        permissions=admin_user.permissions,
        preferences=None,
    )

    with patch(
        "app.services.users.UserService.update",
        new_callable=AsyncMock,
    ) as mock_update:
        mock_update.return_value = updated

        response = client.patch("/users/me", json={"name": "New Name"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "New Name"
