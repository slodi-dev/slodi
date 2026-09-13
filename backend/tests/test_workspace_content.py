"""Tests for workspace content: programs, groups, and tags."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from app.schemas.group import GroupOut
from app.schemas.program import ProgramOut
from app.schemas.task import TaskOut
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceNested

# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_program(workspace_id):
    return ProgramOut(
        content_type="program",
        id=uuid4(),
        workspace_id=workspace_id,
        name="Test Program",
        author_id=uuid4(),
        author_name="Test User",
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


# ── Delete endpoints ───────────────────────────────────────────────────────────


def test_delete_program_returns_204(client, sample_workspace):
    sample_program = _make_program(sample_workspace.id)

    with (
        patch("app.services.programs.ProgramService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.programs.ProgramService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_program
        mock_del.return_value = None

        response = client.delete(f"/programs/{sample_program.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_del.assert_called_once_with(sample_program.id)


def test_delete_program_not_found(client):
    with patch("app.services.programs.ProgramService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Program not found")

        response = client.delete(f"/programs/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_group_returns_204(client):
    sample_group = _make_group()

    with (
        patch("app.services.groups.GroupService.get", new_callable=AsyncMock) as mock_get,
        patch("app.services.groups.GroupService.delete", new_callable=AsyncMock) as mock_del,
    ):
        mock_get.return_value = sample_group
        mock_del.return_value = None

        response = client.delete(f"/groups/{sample_group.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT


def test_get_program_not_found(client):
    with patch("app.services.programs.ProgramService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Program not found")

        response = client.get(f"/programs/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_get_group_not_found(client):
    with patch("app.services.groups.GroupService.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Group not found")

        response = client.get(f"/groups/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_list_workspace_programs_empty(client, sample_workspace):
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
        mock_list.return_value = []
        mock_count.return_value = 0

        response = client.get(f"/workspaces/{sample_workspace.id}/programs")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []


# ── GET /content/{id} — read one item of any kind ─────────────────────────────


def _make_task(workspace_id):
    return TaskOut(
        content_type="task",
        id=uuid4(),
        workspace_id=workspace_id,
        name="Kaðlabrautin",
        author_id=uuid4(),
        author_name="Test User",
        created_at=datetime.now(),
        author=UserOut(
            id=uuid4(), name="Test User", email="test_email@gmail.com", auth0_id="auth0|123"
        ),
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


def test_get_content_reads_a_task(client, sample_workspace):
    """The regression this endpoint exists for.

    `GET /programs/{id}` selects `Program`, which under joined-table
    inheritance never matches a row whose discriminator is "task". Once the
    chooser started filing a Verkefni as a task, every item a leader submitted
    404'd on the detail page the bank had just linked them to.
    """
    sample_task = _make_task(sample_workspace.id)

    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
        ) as mock_type,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as mock_get,
    ):
        mock_type.return_value = "task"
        mock_get.return_value = sample_task

        response = client.get(f"/content/{sample_task.id}")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Kaðlabrautin"
        assert response.json()["content_type"] == "task"
        # The task loader was used, not the program one.
        mock_get.assert_awaited_once()


def test_get_content_reads_a_program(client, sample_workspace):
    sample_program = _make_program(sample_workspace.id)

    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
        ) as mock_type,
        patch("app.services.programs.ProgramService.get", new_callable=AsyncMock) as mock_get,
    ):
        mock_type.return_value = "program"
        mock_get.return_value = sample_program

        response = client.get(f"/content/{sample_program.id}")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["content_type"] == "program"


def test_get_content_unknown_id_is_404(client):
    with patch(
        "app.repositories.programs.ProgramRepository.get_content_type",
        new_callable=AsyncMock,
    ) as mock_type:
        mock_type.return_value = None

        response = client.get(f"/content/{uuid4()}")

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Filtering and paging the bank ─────────────────────────────────────────────


def test_content_list_passes_tags_and_author_to_the_service(client, sample_workspace):
    """Both filters exist because the sidebar offers them.

    Neither had a server-side equivalent while the bank filtered in the
    browser, so moving filtering to the server would silently have dropped
    them — the two most-used narrowings in the sidebar.
    """
    with (
        patch(
            "app.services.programs.ProgramService.list_content_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
        patch(
            "app.services.programs.ProgramService.count_content_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
    ):
        mock_list.return_value = []
        mock_count.return_value = 0

        response = client.get(
            f"/workspaces/{sample_workspace.id}/content",
            params={"tags": ["Útivist", "Leikir"], "author": "Halld", "limit": 12, "offset": 24},
        )

        assert response.status_code == status.HTTP_200_OK
        filters = mock_list.call_args.kwargs["filters"]
        assert filters.tags == ["Útivist", "Leikir"]
        assert filters.author_name == "Halld"
        # The count must see the same filters, or the pager reports a total for
        # a different query than the one on screen.
        assert mock_count.call_args.kwargs["filters"].tags == ["Útivist", "Leikir"]
        assert mock_list.call_args.kwargs["limit"] == 12
        assert mock_list.call_args.kwargs["offset"] == 24


def test_content_list_reports_the_bank_total_not_the_page_size(client, sample_workspace):
    """`X-Total-Count` is what the pager divides into pages.

    The bank fetched a flat 200 rows and counted those, so it advertised
    seventeen pages of a ten-thousand-row bank.
    """
    with (
        patch(
            "app.services.programs.ProgramService.list_content_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
        patch(
            "app.services.programs.ProgramService.count_content_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
    ):
        mock_list.return_value = []
        mock_count.return_value = 10004

        response = client.get(
            f"/workspaces/{sample_workspace.id}/content", params={"limit": 12, "offset": 0}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.headers["X-Total-Count"] == "10004"
        assert 'rel="next"' in response.headers["Link"]


def test_content_facets_are_listed_for_the_sidebar(client, sample_workspace):
    with patch(
        "app.services.programs.ProgramService.facets_for_workspace",
        new_callable=AsyncMock,
    ) as mock_facets:
        mock_facets.return_value = {
            "locations": ["Úti, í skóglendi"],
            "equipment": ["Kaðall", "Hjálmar"],
            "authors": ["Halldór Valberg"],
            "tags": ["Útivist"],
        }

        response = client.get(f"/workspaces/{sample_workspace.id}/content/facets")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["equipment"] == ["Kaðall", "Hjálmar"]
        mock_facets.assert_awaited_once_with(sample_workspace.id)


def _reader_client(mock_db_session, viewer_user):
    """A signed-in reader who is neither the author nor a moderator."""
    from fastapi.testclient import TestClient

    from app.core.auth import get_current_user
    from app.core.db import get_session
    from app.main import create_app

    app = create_app()

    async def _user():
        return viewer_user

    async def _session():
        yield mock_db_session

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_session] = _session
    return TestClient(app)


def test_the_author_sees_their_own_review_state(client, sample_workspace, admin_user):
    """A leader whose submission was rejected otherwise has no way to find out:
    the item simply stops appearing."""
    from app.domain.enums import ReviewState

    task = _make_task(sample_workspace.id)
    task.author_id = admin_user.id
    task.review_state = ReviewState.rejected
    task.review_note = "Of hættulegt"

    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
        ) as mock_type,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as mock_get,
    ):
        mock_type.return_value = "task"
        mock_get.return_value = task

        body = client.get(f"/content/{task.id}").json()

    assert body["review_state"] == "rejected"
    assert body["review_note"] == "Of hættulegt"


def test_another_reader_sees_no_review_state(mock_db_session, viewer_user, sample_workspace):
    """Nobody needs to know how the team judged somebody else's idea."""
    from app.domain.enums import ReviewState
    from app.schemas.workspace import WorkspaceRole

    task = _make_task(sample_workspace.id)  # written by somebody else
    task.review_state = ReviewState.rejected
    task.review_note = "Of hættulegt"

    reader = _reader_client(mock_db_session, viewer_user)

    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
        ) as mock_type,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as mock_get,
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock) as role,
    ):
        mock_type.return_value = "task"
        mock_get.return_value = task
        role.return_value = WorkspaceRole.viewer

        body = reader.get(f"/content/{task.id}").json()

    assert body["review_state"] is None
    assert body["review_note"] is None


@pytest.mark.parametrize(
    ("path", "service_get"),
    [
        ("/content/{id}", "app.services.tasks.TaskService.get"),
        ("/tasks/{id}", "app.services.tasks.TaskService.get"),
    ],
)
def test_no_endpoint_hands_a_reviewers_note_to_a_stranger(
    mock_db_session, viewer_user, sample_workspace, path, service_get
):
    """
    `review_note` is where a moderator writes why they turned something down.

    Every endpoint returning a `ContentOut` subclass carries the field, so every
    one of them has to answer this. `/content/{id}` did and `/tasks/{id}` did
    not, which is the whole reason `apply_review_visibility` exists — this is
    parametrised so a new read path is a line here rather than a silent hole.
    """
    from app.domain.enums import ReviewState
    from app.schemas.workspace import WorkspaceRole

    task = _make_task(sample_workspace.id)  # written by somebody else
    task.review_state = ReviewState.rejected
    task.review_note = "Of hættulegt"

    reader = _reader_client(mock_db_session, viewer_user)

    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
        ) as mock_type,
        patch(service_get, new_callable=AsyncMock) as mock_get,
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock) as role,
    ):
        mock_type.return_value = "task"
        mock_get.return_value = task
        role.return_value = WorkspaceRole.viewer

        body = reader.get(path.format(id=task.id)).json()

    assert body["review_state"] is None, f"{path} leaked review_state"
    assert body["review_note"] is None, f"{path} leaked review_note"


def test_the_author_can_still_open_their_own_hidden_item(client, sample_workspace, admin_user):
    """
    Hiding sends the author a mail saying the item is no longer listed. If the
    item then 404s for them, that mail points at a dead link — and the review
    state on the page, added so a leader could find out what happened, is
    unreadable in the one case where the item actually disappeared.
    """
    task = _make_task(sample_workspace.id)
    task.author_id = admin_user.id
    task.hidden_at = datetime(2026, 9, 13, tzinfo=UTC)

    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
        ) as mock_type,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as mock_get,
    ):
        mock_type.return_value = "task"
        mock_get.return_value = task

        res = client.get(f"/content/{task.id}")

    assert res.status_code == 200
    assert res.json()["hidden_at"] is not None


def test_a_hidden_item_is_not_found_for_anybody_else(
    mock_db_session, viewer_user, sample_workspace
):
    """404 rather than 403: a 403 confirms an item exists at that id, which is
    the thing hiding is trying to stop."""
    from app.schemas.workspace import WorkspaceRole

    task = _make_task(sample_workspace.id)  # written by somebody else
    task.hidden_at = datetime(2026, 9, 13, tzinfo=UTC)

    reader = _reader_client(mock_db_session, viewer_user)

    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type",
            new_callable=AsyncMock,
        ) as mock_type,
        patch("app.services.tasks.TaskService.get", new_callable=AsyncMock) as mock_get,
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock) as role,
    ):
        mock_type.return_value = "task"
        mock_get.return_value = task
        role.return_value = WorkspaceRole.viewer

        res = reader.get(f"/content/{task.id}")

    assert res.status_code == 404
