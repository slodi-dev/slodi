"""Who may change an item's tags — see sc-486.

Tagging is editing, so it takes the item's rule. This used to be a bespoke
`author or platform admin` check that refused a moderator, because it compared
against `Permissions.admin` by equality and a moderator ranks below it.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.main import create_app
from app.schemas.workspace import WorkspaceRole


def _client_as(user, session):
    app = create_app()

    async def _user():
        return user

    async def _session():
        yield session

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_session] = _session
    return TestClient(app)


def _retag(user, session, *, author_id, workspace_role=WorkspaceRole.viewer):
    content_id, tag_id = uuid4(), uuid4()
    with (
        patch("app.services.content.ContentService.get_author_id", new_callable=AsyncMock) as ga,
        patch("app.services.content.ContentService.get_workspace_id", new_callable=AsyncMock) as gw,
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock) as role,
        patch("app.services.tags.TagService.add_content_tag", new_callable=AsyncMock) as add,
    ):
        ga.return_value = author_id
        gw.return_value = uuid4()
        role.return_value = workspace_role
        add.return_value = (True, {"content_id": str(content_id), "tag_id": str(tag_id)})

        return _client_as(user, session).put(f"/content/{content_id}/tags/{tag_id}")


def test_a_moderator_can_retag_somebody_elses_item(mock_db_session, moderator_user):
    """Curating the vocabulary is the job the moderator rank exists for."""
    res = _retag(moderator_user, mock_db_session, author_id=uuid4())
    assert res.status_code in (200, 201)


def test_a_workspace_admin_can_retag_content_in_their_workspace(mock_db_session, viewer_user):
    res = _retag(
        viewer_user, mock_db_session, author_id=uuid4(), workspace_role=WorkspaceRole.admin
    )
    assert res.status_code in (200, 201)


def test_a_plain_member_cannot_retag_somebody_elses_item(mock_db_session, viewer_user):
    """Opening the bank must not let any member rewrite anyone's metadata."""
    res = _retag(viewer_user, mock_db_session, author_id=uuid4())
    assert res.status_code == 403


def test_the_author_can_retag_their_own_item(mock_db_session, viewer_user):
    res = _retag(viewer_user, mock_db_session, author_id=viewer_user.id)
    assert res.status_code in (200, 201)


@pytest.mark.parametrize("method", ["put", "delete"])
def test_a_suspended_leader_cannot_retag(mock_db_session, viewer_user, method):
    """Retagging your own item is editing your own content, which skammarkrókur
    blocks (sc-431).

    Asserted by making the real dependency refuse and watching the request fail
    with it: if the endpoint did not declare `require_not_suspended`, the
    override would be ignored and the call would succeed.
    """
    from fastapi import HTTPException

    from app.core.auth import require_not_suspended

    content_id, tag_id = uuid4(), uuid4()
    app = create_app()

    async def _user():
        return viewer_user

    async def _session():
        yield mock_db_session

    async def _suspended():
        raise HTTPException(status_code=403, detail="Þú getur ekki sent inn efni í bankann.")

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[require_not_suspended] = _suspended

    with (
        patch("app.services.content.ContentService.get_author_id", new_callable=AsyncMock) as ga,
        patch("app.services.content.ContentService.get_workspace_id", new_callable=AsyncMock) as gw,
        patch("app.services.tags.TagService.add_content_tag", new_callable=AsyncMock) as add,
        patch("app.services.tags.TagService.remove_content_tag", new_callable=AsyncMock),
    ):
        ga.return_value = viewer_user.id  # their own item
        gw.return_value = uuid4()
        add.return_value = (True, {"content_id": str(content_id), "tag_id": str(tag_id)})

        res = getattr(TestClient(app), method)(f"/content/{content_id}/tags/{tag_id}")

    assert res.status_code == 403
