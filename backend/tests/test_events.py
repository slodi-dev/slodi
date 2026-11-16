"""Tests for the events router."""

from datetime import datetime as dt
from datetime import timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import status

from app.schemas.event import EventListOut, EventOut
from app.schemas.user import UserOutLimited
from app.schemas.workspace import WorkspaceNested

pytestmark = pytest.mark.usefixtures("content_access")

# ── Helpers ───────────────────────────────────────────────────────────────────

_NOW = dt(2025, 6, 1, 10, 0, tzinfo=timezone.utc)


def _make_event(workspace_id, program_id=None):
    author_id = uuid4()
    return EventOut(
        content_type="event",
        level=1,
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
        content_type="event",
        level=1,
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


# ── Get / update / delete ─────────────────────────────────────────────────────


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


def test_delete_event_not_found(client, content_access):
    content_access.return_value = None

    response = client.delete(f"/events/{uuid4()}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
