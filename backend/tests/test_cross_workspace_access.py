"""`GET /comments/{comment_id}` answered for content the caller could not otherwise reach (sc-538)."""

import datetime as dt
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import WorkspaceRole
from app.main import create_app
from app.repositories.content import ContentAccess
from app.schemas.comment import CommentOut
from app.utils import get_current_datetime

ACCESS = "app.repositories.content.ContentRepository.get_access"
ROLE = "app.core.auth._get_workspace_role"


def _client_as(user, session):
    app = create_app()

    async def _user():
        return user

    async def _session():
        yield session

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_session] = _session
    return TestClient(app)


# ── Single comment (unit) ─────────────────────────────────────────────────────


def _comment(content_id):
    return CommentOut(
        id=uuid4(),
        body="Halló",
        author_name="Jana",
        created_at=dt.datetime.now(dt.UTC),
        user_id=uuid4(),
        content_id=content_id,
    )


def test_a_non_member_cannot_read_a_comment_by_id(mock_db_session, viewer_user):
    content_id = uuid4()
    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as get,
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
    ):
        get.return_value = _comment(content_id)
        access.return_value = ContentAccess(uuid4(), uuid4(), None)
        role.return_value = None

        res = _client_as(viewer_user, mock_db_session).get(f"/comments/{uuid4()}")

    assert res.status_code == 404
    access.assert_awaited_once_with(content_id)


def test_a_comment_under_hidden_content_is_not_readable(mock_db_session, viewer_user):
    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as get,
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
    ):
        get.return_value = _comment(uuid4())
        access.return_value = ContentAccess(uuid4(), uuid4(), get_current_datetime())
        role.return_value = WorkspaceRole.viewer

        res = _client_as(viewer_user, mock_db_session).get(f"/comments/{uuid4()}")

    assert res.status_code == 404


def test_a_member_can_read_a_comment_by_id(mock_db_session, viewer_user):
    with (
        patch("app.services.comments.CommentService.get", new_callable=AsyncMock) as get,
        patch(ACCESS, new_callable=AsyncMock) as access,
        patch(ROLE, new_callable=AsyncMock) as role,
    ):
        get.return_value = _comment(uuid4())
        access.return_value = ContentAccess(uuid4(), uuid4(), None)
        role.return_value = WorkspaceRole.viewer

        res = _client_as(viewer_user, mock_db_session).get(f"/comments/{uuid4()}")

    assert res.status_code == 200
