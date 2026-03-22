"""Tests for the tasks router."""

from datetime import datetime as dt
from datetime import timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.event import EventOut
from app.schemas.task import TaskListOut, TaskOut
from app.schemas.user import UserOutLimited
from app.schemas.workspace import WorkspaceNested

# ── Helpers ───────────────────────────────────────────────────────────────────

_NOW = dt(2025, 6, 1, 10, 0, tzinfo=timezone.utc)


def _make_task(workspace_id, event_id=None):
    author_id = uuid4()
    return TaskOut(
        id=uuid4(),
        workspace_id=workspace_id,
        name="Test Task",
        author_id=author_id,
        author_name="Test User",
        created_at=_NOW,
        event_id=event_id,
        author=UserOutLimited(id=author_id, name="Test User"),
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


def _make_task_list_out(workspace_id, event_id=None):
    return TaskListOut(
        id=uuid4(),
        workspace_id=workspace_id,
        name="Test Task",
        author_id=uuid4(),
        author_name="Test User",
        created_at=_NOW,
        event_id=event_id,
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


def _make_event(workspace_id):
    author_id = uuid4()
    return EventOut(
        id=uuid4(),
        workspace_id=workspace_id,
        name="Test Event",
        author_id=author_id,
        author_name="Test User",
        created_at=_NOW,
        start_dt=_NOW,
        end_dt=None,
        program_id=None,
        author=UserOutLimited(id=author_id, name="Test User"),
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


# ── List tasks ────────────────────────────────────────────────────────────────


def test_list_workspace_tasks(client, sample_workspace):
    task = _make_task_list_out(sample_workspace.id)

    with (
        patch(
            "app.services.tasks.TaskService.count_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.tasks.TaskService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 1
        mock_list.return_value = [task]

        response = client.get(f"/workspaces/{sample_workspace.id}/tasks")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == task.name


def test_list_workspace_tasks_empty(client, sample_workspace):
    with (
        patch(
            "app.services.tasks.TaskService.count_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.tasks.TaskService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 0
        mock_list.return_value = []

        response = client.get(f"/workspaces/{sample_workspace.id}/tasks")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []


def test_list_event_tasks(client, sample_workspace):
    event = _make_event(sample_workspace.id)
    task = _make_task_list_out(sample_workspace.id, event_id=event.id)

    with (
        patch(
            "app.services.events.EventService.get",
            new_callable=AsyncMock,
        ) as mock_event_get,
        patch(
            "app.services.tasks.TaskService.count_tasks_for_event",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.tasks.TaskService.list_for_event",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_event_get.return_value = event
        mock_count.return_value = 1
        mock_list.return_value = [task]

        response = client.get(f"/events/{event.id}/tasks")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == task.name


# ── Create tasks ──────────────────────────────────────────────────────────────


def test_create_workspace_task(client, sample_workspace):
    task = _make_task(sample_workspace.id)

    with patch(
        "app.services.tasks.TaskService.create_under_workspace",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = task

        response = client.post(
            f"/workspaces/{sample_workspace.id}/tasks",
            json={"name": "Test Task"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == "Test Task"


def test_create_event_task(client, sample_workspace):
    event = _make_event(sample_workspace.id)
    task = _make_task(sample_workspace.id, event_id=event.id)

    with (
        patch(
            "app.services.events.EventService.get",
            new_callable=AsyncMock,
        ) as mock_event_get,
        patch(
            "app.services.tasks.TaskService.create_under_event",
            new_callable=AsyncMock,
        ) as mock_create,
    ):
        mock_event_get.return_value = event
        mock_create.return_value = task

        response = client.post(
            f"/events/{event.id}/tasks",
            json={"name": "Test Task"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == "Test Task"
        assert response.json()["event_id"] == str(event.id)


# ── Get / update / delete ─────────────────────────────────────────────────────


def test_get_task(client, sample_workspace):
    task = _make_task(sample_workspace.id)

    with patch(
        "app.services.tasks.TaskService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = task

        response = client.get(f"/tasks/{task.id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == task.name


def test_get_task_not_found(client):
    with patch(
        "app.services.tasks.TaskService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Task not found")

        response = client.get(f"/tasks/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_update_task(client, sample_workspace):
    task = _make_task(sample_workspace.id)
    updated = task.model_copy(update={"name": "Updated Task"})

    with (
        patch(
            "app.services.tasks.TaskService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.tasks.TaskService.update",
            new_callable=AsyncMock,
        ) as mock_update,
    ):
        mock_get.return_value = task
        mock_update.return_value = updated

        response = client.patch(f"/tasks/{task.id}", json={"name": "Updated Task"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Updated Task"


def test_delete_task(client, sample_workspace):
    task = _make_task(sample_workspace.id)

    with (
        patch(
            "app.services.tasks.TaskService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.tasks.TaskService.delete",
            new_callable=AsyncMock,
        ) as mock_delete,
    ):
        mock_get.return_value = task
        mock_delete.return_value = None

        response = client.delete(f"/tasks/{task.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_delete.assert_called_once_with(task.id)


def test_delete_task_not_found(client):
    with patch(
        "app.services.tasks.TaskService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Task not found")

        response = client.delete(f"/tasks/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
