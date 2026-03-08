"""Unit tests for get_current_user — auto-add to default workspace."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.auth import get_current_user
from app.domain.enums import Permissions, WorkspaceRole
from app.schemas.user import UserOut


@pytest.fixture
def new_user():
    return UserOut(
        id=uuid4(),
        auth0_id="auth0|new_user",
        email="new@example.com",
        name="New User",
        pronouns=None,
        permissions=Permissions.viewer,
        preferences=None,
    )


@pytest.fixture
def mock_credentials():
    creds = MagicMock()
    creds.credentials = "fake.jwt.token"
    return creds


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.mark.asyncio
async def test_new_user_added_to_default_workspace(new_user, mock_credentials, mock_session):
    """New users are added to the default workspace with viewer role when DEFAULT_WORKSPACE_ID is set."""
    default_ws_id = uuid4()

    with (
        patch("app.core.auth.asyncio.to_thread", new_callable=AsyncMock) as mock_verify,
        patch("app.core.auth.user_cache.get", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.user_cache.set", new_callable=AsyncMock),
        patch("app.core.auth.UserService") as MockUserService,
        patch("app.core.auth.WorkspaceService") as MockWorkspaceService,
        patch("app.core.auth._DEFAULT_WORKSPACE_ID", default_ws_id),
    ):
        mock_payload = MagicMock()
        mock_payload.sub = new_user.auth0_id
        mock_payload.email = new_user.email
        mock_payload.name = new_user.name
        mock_verify.return_value = mock_payload

        user_svc = AsyncMock()
        user_svc.get_by_auth0_id.return_value = None
        user_svc.create.return_value = new_user
        MockUserService.return_value = user_svc

        ws_svc = AsyncMock()
        MockWorkspaceService.return_value = ws_svc

        result = await get_current_user(mock_credentials, mock_session)

        assert result == new_user
        ws_svc.set_member_role.assert_awaited_once_with(
            default_ws_id, new_user.id, WorkspaceRole.viewer
        )


@pytest.mark.asyncio
async def test_new_user_no_default_workspace(new_user, mock_credentials, mock_session):
    """WorkspaceService is not called when DEFAULT_WORKSPACE_ID is not set."""
    with (
        patch("app.core.auth.asyncio.to_thread", new_callable=AsyncMock) as mock_verify,
        patch("app.core.auth.user_cache.get", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.user_cache.set", new_callable=AsyncMock),
        patch("app.core.auth.UserService") as MockUserService,
        patch("app.core.auth.WorkspaceService") as MockWorkspaceService,
        patch("app.core.auth._DEFAULT_WORKSPACE_ID", None),
    ):
        mock_payload = MagicMock()
        mock_payload.sub = new_user.auth0_id
        mock_payload.email = new_user.email
        mock_payload.name = new_user.name
        mock_verify.return_value = mock_payload

        user_svc = AsyncMock()
        user_svc.get_by_auth0_id.return_value = None
        user_svc.create.return_value = new_user
        MockUserService.return_value = user_svc

        ws_svc = AsyncMock()
        MockWorkspaceService.return_value = ws_svc

        result = await get_current_user(mock_credentials, mock_session)

        assert result == new_user
        ws_svc.set_member_role.assert_not_called()


@pytest.mark.asyncio
async def test_workspace_add_failure_doesnt_block_login(new_user, mock_credentials, mock_session):
    """A failure adding the user to the default workspace does not prevent login."""
    default_ws_id = uuid4()

    with (
        patch("app.core.auth.asyncio.to_thread", new_callable=AsyncMock) as mock_verify,
        patch("app.core.auth.user_cache.get", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.user_cache.set", new_callable=AsyncMock),
        patch("app.core.auth.UserService") as MockUserService,
        patch("app.core.auth.WorkspaceService") as MockWorkspaceService,
        patch("app.core.auth._DEFAULT_WORKSPACE_ID", default_ws_id),
        patch("app.core.auth.logger") as mock_logger,
    ):
        mock_payload = MagicMock()
        mock_payload.sub = new_user.auth0_id
        mock_payload.email = new_user.email
        mock_payload.name = new_user.name
        mock_verify.return_value = mock_payload

        user_svc = AsyncMock()
        user_svc.get_by_auth0_id.return_value = None
        user_svc.create.return_value = new_user
        MockUserService.return_value = user_svc

        ws_svc = AsyncMock()
        ws_svc.set_member_role.side_effect = Exception("DB unavailable")
        MockWorkspaceService.return_value = ws_svc

        result = await get_current_user(mock_credentials, mock_session)

        assert result == new_user
        mock_logger.warning.assert_called_once()
