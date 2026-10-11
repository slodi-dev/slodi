"""Which readers get hidden child items on the detail endpoints — see sc-537.

The repository can keep hidden events/tasks in a parent's nested list
(`include_hidden_children`); the route decides who that is. Moderators and
admins need to see what the team hid in order to unhide it; everyone else must
not. The loaders themselves are covered in test_deleted_nested_content.py.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import ContentType, Permissions
from app.main import create_app
from app.schemas.user import UserOut


def _client(mock_db_session, permissions):
    user = UserOut(
        id=uuid4(),
        auth0_id=f"auth0|{permissions}",
        email=f"{permissions}@test.is",
        name=permissions.value.title(),
        permissions=permissions,
    )
    app = create_app()

    async def override_get_session():
        yield mock_db_session

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


# The service is stopped with a 404 so the test only has to look at how it was
# called; what comes back is the loaders' concern, not the route's.
_STOP = HTTPException(status_code=404, detail="stop")

CASES = [
    (Permissions.viewer, False),
    (Permissions.member, False),
    (Permissions.moderator, True),
    (Permissions.admin, True),
]


@pytest.mark.parametrize("permissions,expected", CASES)
def test_program_detail_includes_hidden_events_only_for_moderators(
    mock_db_session, permissions, expected
):
    client = _client(mock_db_session, permissions)
    with patch("app.routers.programs.ProgramService.get", new_callable=AsyncMock) as get:
        get.side_effect = _STOP
        assert client.get(f"/programs/{uuid4()}").status_code == 404
    assert get.await_args.kwargs["include_hidden_children"] is expected


@pytest.mark.parametrize("permissions,expected", CASES)
def test_event_detail_includes_hidden_tasks_only_for_moderators(
    mock_db_session, permissions, expected
):
    client = _client(mock_db_session, permissions)
    with patch("app.routers.events.EventService.get", new_callable=AsyncMock) as get:
        get.side_effect = _STOP
        assert client.get(f"/events/{uuid4()}").status_code == 404
    assert get.await_args.kwargs["include_hidden_children"] is expected


@pytest.mark.parametrize(
    "content_type,target",
    [
        (ContentType.program, "app.routers.programs.ProgramService.get"),
        (ContentType.event, "app.routers.programs.EventService.get"),
    ],
)
@pytest.mark.parametrize("permissions,expected", CASES)
def test_content_detail_includes_hidden_children_only_for_moderators(
    mock_db_session, permissions, expected, content_type, target
):
    client = _client(mock_db_session, permissions)
    with (
        patch(
            "app.repositories.programs.ProgramRepository.get_content_type", new_callable=AsyncMock
        ) as kind,
        patch(target, new_callable=AsyncMock) as get,
    ):
        kind.return_value = content_type
        get.side_effect = _STOP
        assert client.get(f"/content/{uuid4()}").status_code == 404
    assert get.await_args.kwargs["include_hidden_children"] is expected
