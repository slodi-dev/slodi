"""Tests for the troops router."""

from datetime import datetime as dt
from datetime import timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.event import EventOut
from app.schemas.troop import TroopOut, TroopParticipationOut
from app.schemas.user import UserOutLimited
from app.schemas.workspace import WorkspaceNested

# ── Helpers ───────────────────────────────────────────────────────────────────

_NOW = dt(2025, 6, 1, 10, 0, tzinfo=timezone.utc)


def _make_troop(workspace_id):
    return TroopOut(id=uuid4(), name="Test Troop", workspace_id=workspace_id)


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


# ── Workspace-scoped troops ───────────────────────────────────────────────────


def test_list_workspace_troops(client, sample_workspace):
    troop = _make_troop(sample_workspace.id)

    with (
        patch(
            "app.services.troops.TroopService.count_troops_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.troops.TroopService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 1
        mock_list.return_value = [troop]

        response = client.get(f"/workspaces/{sample_workspace.id}/troops")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == troop.name


def test_list_workspace_troops_empty(client, sample_workspace):
    with (
        patch(
            "app.services.troops.TroopService.count_troops_for_workspace",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.troops.TroopService.list_for_workspace",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_count.return_value = 0
        mock_list.return_value = []

        response = client.get(f"/workspaces/{sample_workspace.id}/troops")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []


def test_create_troop(client, sample_workspace):
    troop = _make_troop(sample_workspace.id)

    with patch(
        "app.services.troops.TroopService.create_under_workspace",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = troop

        response = client.post(
            f"/workspaces/{sample_workspace.id}/troops",
            json={"name": "Test Troop"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["name"] == "Test Troop"


# ── Troop item endpoints ──────────────────────────────────────────────────────


def test_get_troop(client, sample_workspace):
    troop = _make_troop(sample_workspace.id)

    with patch(
        "app.services.troops.TroopService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = troop

        response = client.get(f"/troops/{troop.id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == troop.name


def test_get_troop_not_found(client):
    with patch(
        "app.services.troops.TroopService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Troop not found")

        response = client.get(f"/troops/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


def test_update_troop(client, sample_workspace):
    troop = _make_troop(sample_workspace.id)
    updated = troop.model_copy(update={"name": "Updated Troop"})

    with (
        patch(
            "app.services.troops.TroopService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.troops.TroopService.update",
            new_callable=AsyncMock,
        ) as mock_update,
    ):
        mock_get.return_value = troop
        mock_update.return_value = updated

        response = client.patch(f"/troops/{troop.id}", json={"name": "Updated Troop"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Updated Troop"


def test_delete_troop(client, sample_workspace):
    troop = _make_troop(sample_workspace.id)

    with (
        patch(
            "app.services.troops.TroopService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.troops.TroopService.delete",
            new_callable=AsyncMock,
        ) as mock_delete,
    ):
        mock_get.return_value = troop
        mock_delete.return_value = None

        response = client.delete(f"/troops/{troop.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_delete.assert_called_once_with(troop.id)


def test_delete_troop_not_found(client):
    with patch(
        "app.services.troops.TroopService.get",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Troop not found")

        response = client.delete(f"/troops/{uuid4()}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Participations ────────────────────────────────────────────────────────────


def test_list_event_troops(client, sample_workspace):
    event = _make_event(sample_workspace.id)
    troop = _make_troop(sample_workspace.id)

    with (
        patch(
            "app.services.events.EventService.get",
            new_callable=AsyncMock,
        ) as mock_event_get,
        patch(
            "app.services.troops.TroopService.count_event_troops",
            new_callable=AsyncMock,
        ) as mock_count,
        patch(
            "app.services.troops.TroopService.list_event_troops",
            new_callable=AsyncMock,
        ) as mock_list,
    ):
        mock_event_get.return_value = event
        mock_count.return_value = 1
        mock_list.return_value = [troop]

        response = client.get(f"/events/{event.id}/troops")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == troop.name


def test_add_troop_participation(client, sample_workspace):
    event = _make_event(sample_workspace.id)
    troop = _make_troop(sample_workspace.id)
    participation = TroopParticipationOut(troop_id=troop.id, event_id=event.id)

    with (
        patch(
            "app.services.troops.TroopService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.troops.TroopService.add_participation",
            new_callable=AsyncMock,
        ) as mock_add,
    ):
        mock_get.return_value = troop
        mock_add.return_value = (True, participation)

        response = client.put(f"/events/{event.id}/troops/{troop.id}")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["troop_id"] == str(troop.id)
        assert response.json()["event_id"] == str(event.id)


def test_add_troop_participation_idempotent(client, sample_workspace):
    """PUT on existing participation returns 200 instead of 201."""
    event = _make_event(sample_workspace.id)
    troop = _make_troop(sample_workspace.id)
    participation = TroopParticipationOut(troop_id=troop.id, event_id=event.id)

    with (
        patch(
            "app.services.troops.TroopService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.troops.TroopService.add_participation",
            new_callable=AsyncMock,
        ) as mock_add,
    ):
        mock_get.return_value = troop
        mock_add.return_value = (False, participation)

        response = client.put(f"/events/{event.id}/troops/{troop.id}")
        assert response.status_code == status.HTTP_200_OK


def test_remove_troop_participation(client, sample_workspace):
    event = _make_event(sample_workspace.id)
    troop = _make_troop(sample_workspace.id)

    with (
        patch(
            "app.services.troops.TroopService.get",
            new_callable=AsyncMock,
        ) as mock_get,
        patch(
            "app.services.troops.TroopService.remove_participation",
            new_callable=AsyncMock,
        ) as mock_remove,
    ):
        mock_get.return_value = troop
        mock_remove.return_value = None

        response = client.delete(f"/events/{event.id}/troops/{troop.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_remove.assert_called_once_with(event.id, troop.id)
