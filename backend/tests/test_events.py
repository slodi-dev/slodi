"""Tests for the events router."""

from datetime import datetime as dt
from datetime import timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.event import EventListOut, EventOut
from app.schemas.user import UserOutLimited
from app.schemas.workspace import WorkspaceNested

# ── Helpers ───────────────────────────────────────────────────────────────────

_NOW = dt(2025, 6, 1, 10, 0, tzinfo=timezone.utc)


def _make_event(workspace_id, program_id=None):
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
        program_id=program_id,
        author=UserOutLimited(id=author_id, name="Test User"),
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


def _make_event_list_out(workspace_id, program_id=None):
    return EventListOut(
        id=uuid4(),
        workspace_id=workspace_id,
        name="Test Event",
        author_id=uuid4(),
        author_name="Test User",
        created_at=_NOW,
        start_dt=_NOW,
        end_dt=None,
        program_id=program_id,
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )


# ── List workspace events ─────────────────────────────────────────────────────


def test_list_workspace_events(client, sample_workspace):
    event = _make_event_list_out(sample_workspace.id)

    with (
        patch(
            "app.services.events.EventService.count_events_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.events.EventService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 1
        mock_list.return_value = [event]

        response = client.get(f"/workspaces/{sample_workspace.id}/events")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == event.name


def test_list_workspace_events_empty(client, sample_workspace):
    with (
        patch(
            "app.services.events.EventService.count_events_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.events.EventService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 0
        mock_list.return_value = []

        response = client.get(f"/workspaces/{sample_workspace.id}/events")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []


def test_list_workspace_events_with_date_filters(client, sample_workspace):
    with (
        patch(
            "app.services.events.EventService.count_events_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.events.EventService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 0
        mock_list.return_value = []

        response = client.get(
            f"/workspaces/{sample_workspace.id}/events",
            params={"date_from": "2025-01-01T00:00:00Z", "date_to": "2025-12-31T23:59:59Z"},
        )
        assert response.status_code == status.HTTP_200_OK


# ── List program events ───────────────────────────────────────────────────────


def test_list_program_events(client, sample_workspace):
    program_id = uuid4()
    event = _make_event_list_out(sample_workspace.id, program_id=program_id)

    with (
        patch(
            "app.services.events.EventService.count_events_for_program",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.events.EventService.list_for_program",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 1
        mock_list.return_value = [event]

        response = client.get(f"/workspaces/{sample_workspace.id}/programs/{program_id}/events")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1


# ── Create events ─────────────────────────────────────────────────────────────


def test_create_workspace_event(client, sample_workspace):
    event = _make_event(sample_workspace.id)

    with patch(
        "app.services.events.EventService.create_under_workspace",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = event

        response = client.post(
            f"/workspaces/{sample_workspace.id}/events",
            json={"name": "Test Event", "start_dt": _NOW.isoformat()},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == "Test Event"


def test_create_program_event(client):
    program_id = uuid4()
    workspace_id = uuid4()
    from app.schemas.program import ProgramOut
    from app.schemas.workspace import WorkspaceNested

    program = ProgramOut(
        id=program_id,
        workspace_id=workspace_id,
        name="Test Program",
        author_id=uuid4(),
        author_name="Test User",
        created_at=_NOW,
        author=UserOutLimited(id=uuid4(), name="Test User"),
        workspace=WorkspaceNested(id=workspace_id, name="Test Workspace"),
    )
    event = _make_event(workspace_id, program_id=program_id)

    with (
        patch(
            "app.services.programs.ProgramService.get",
            new_callable=AsyncMock,
        ) as mock_prog_get,
        patch(
            "app.services.events.EventService.create_under_program",
            new_callable=AsyncMock,
        ) as mock_create,
    ):
        mock_prog_get.return_value = program
        mock_create.return_value = event

        response = client.post(
            f"/programs/{program_id}/events",
            json={"name": "Test Event", "start_dt": _NOW.isoformat()},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == "Test Event"


# ── Get / update / delete ─────────────────────────────────────────────────────


def test_get_event(client, sample_workspace):
    event = _make_event(sample_workspace.id)

    with patch(
        "app.services.events.EventService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = event

        response = client.get(f"/events/{event.id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == event.name


def test_get_event_not_found(client):
    with patch(
        "app.services.events.EventService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Event not found")

        response = client.get(f"/events/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_update_event(client, sample_workspace):
    event = _make_event(sample_workspace.id)
    updated = _make_event(sample_workspace.id)
    updated = updated.model_copy(update={"name": "Updated Event"})

    with (
        patch(
            "app.services.events.EventService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.events.EventService.update",
            new_callable=AsyncMock,
        ) as mock_update,
    ):
        mock_get.return_value = event
        mock_update.return_value = updated

        response = client.patch(
            f"/events/{event.id}",
            json={"name": "Updated Event"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Updated Event"


def test_delete_event(client, sample_workspace):
    event = _make_event(sample_workspace.id)

    with (
        patch(
            "app.services.events.EventService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.events.EventService.delete",
            new_callable=AsyncMock,
        ) as mock_delete,
    ):
        mock_get.return_value = event
        mock_delete.return_value = None

        response = client.delete(f"/events/{event.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_delete.assert_called_once_with(event.id)


def test_delete_event_not_found(client):
    with patch(
        "app.services.events.EventService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Event not found")

        response = client.delete(f"/events/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
