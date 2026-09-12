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
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.membership_cache.set", new_callable=AsyncMock),
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
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.membership_cache.set", new_callable=AsyncMock),
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


# ── Existing accounts, not just new ones ─────────────────────────────────────
#
# The auto-join used to sit inside the branch that *creates* a user, so it only
# ever ran on first login. Everyone who signed up before DEFAULT_WORKSPACE_ID
# was configured — the entire existing user base — never got a membership, and
# for them the bank 403s on read and 404s on submit. These pin the durable half
# of the fix: membership is ensured on every login, idempotently.


@pytest.fixture
def existing_user():
    return UserOut(
        id=uuid4(),
        auth0_id="auth0|existing_user",
        email="old@example.com",
        name="Existing User",
        pronouns=None,
        permissions=Permissions.viewer,
        preferences=None,
    )


@pytest.mark.asyncio
async def test_an_existing_non_member_is_added_on_login(
    existing_user, mock_credentials, mock_session
):
    """The account that predates the default workspace heals itself by signing in."""
    ws_id = uuid4()

    with (
        patch("app.core.auth.asyncio.to_thread", new_callable=AsyncMock) as mock_verify,
        patch("app.core.auth.user_cache.get", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.user_cache.set", new_callable=AsyncMock),
        patch("app.core.auth.UserService") as MockUserService,
        patch("app.core.auth.WorkspaceService") as MockWorkspaceService,
        patch("app.core.auth._DEFAULT_WORKSPACE_ID", ws_id),
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.membership_cache.set", new_callable=AsyncMock),
    ):
        payload = MagicMock()
        payload.sub = existing_user.auth0_id
        payload.email = existing_user.email
        payload.name = existing_user.name
        mock_verify.return_value = payload

        user_svc = AsyncMock()
        # The account already exists — this is the path that used to skip the join.
        user_svc.get_by_auth0_id.return_value = existing_user
        MockUserService.return_value = user_svc

        ws_svc = AsyncMock()
        MockWorkspaceService.return_value = ws_svc

        result = await get_current_user(mock_credentials, mock_session)

        assert result == existing_user
        ws_svc.set_member_role.assert_awaited_once_with(
            ws_id, existing_user.id, WorkspaceRole.viewer
        )


@pytest.mark.asyncio
async def test_an_existing_member_is_never_downgraded(
    existing_user, mock_credentials, mock_session
):
    """Someone who runs the bank must not be reset to viewer every time they log in.

    `set_member_role` also refuses to demote the workspace owner outright, so an
    unguarded call would raise 400 on the owner's own login.
    """
    ws_id = uuid4()

    with (
        patch("app.core.auth.asyncio.to_thread", new_callable=AsyncMock) as mock_verify,
        patch("app.core.auth.user_cache.get", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.user_cache.set", new_callable=AsyncMock),
        patch("app.core.auth.UserService") as MockUserService,
        patch("app.core.auth.WorkspaceService") as MockWorkspaceService,
        patch("app.core.auth._DEFAULT_WORKSPACE_ID", ws_id),
        patch(
            "app.core.auth._get_workspace_role",
            new_callable=AsyncMock,
            return_value=WorkspaceRole.admin,
        ),
    ):
        payload = MagicMock()
        payload.sub = existing_user.auth0_id
        payload.email = existing_user.email
        payload.name = existing_user.name
        mock_verify.return_value = payload

        user_svc = AsyncMock()
        user_svc.get_by_auth0_id.return_value = existing_user
        MockUserService.return_value = user_svc

        ws_svc = AsyncMock()
        MockWorkspaceService.return_value = ws_svc

        await get_current_user(mock_credentials, mock_session)

        ws_svc.set_member_role.assert_not_called()


@pytest.mark.asyncio
async def test_the_new_membership_replaces_the_cached_non_member_entry(
    existing_user, mock_credentials, mock_session
):
    """Otherwise the fix locks the user out for the length of the cache TTL.

    `_get_workspace_role` caches a confirmed non-member as `None`. That entry is
    written *before* the membership is created and would outlive it, so the very
    request that finally grants access would be followed by a TTL's worth of
    403s — the failure the join exists to prevent, now with a delay on it.
    """
    ws_id = uuid4()
    cache_set = AsyncMock()

    with (
        patch("app.core.auth.asyncio.to_thread", new_callable=AsyncMock) as mock_verify,
        patch("app.core.auth.user_cache.get", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.user_cache.set", new_callable=AsyncMock),
        patch("app.core.auth.UserService") as MockUserService,
        patch("app.core.auth.WorkspaceService") as MockWorkspaceService,
        patch("app.core.auth._DEFAULT_WORKSPACE_ID", ws_id),
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.membership_cache.set", cache_set),
    ):
        payload = MagicMock()
        payload.sub = existing_user.auth0_id
        payload.email = existing_user.email
        payload.name = existing_user.name
        mock_verify.return_value = payload

        user_svc = AsyncMock()
        user_svc.get_by_auth0_id.return_value = existing_user
        MockUserService.return_value = user_svc
        MockWorkspaceService.return_value = AsyncMock()

        await get_current_user(mock_credentials, mock_session)

        # Argument order matters: the cache is keyed user-first.
        cache_set.assert_awaited_once_with(existing_user.id, ws_id, WorkspaceRole.viewer)


@pytest.mark.asyncio
async def test_a_failed_join_leaves_the_cache_alone(
    existing_user, mock_credentials, mock_session
):
    """Priming the cache after a failed insert would assert a membership that does not exist."""
    ws_id = uuid4()
    cache_set = AsyncMock()

    with (
        patch("app.core.auth.asyncio.to_thread", new_callable=AsyncMock) as mock_verify,
        patch("app.core.auth.user_cache.get", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.user_cache.set", new_callable=AsyncMock),
        patch("app.core.auth.UserService") as MockUserService,
        patch("app.core.auth.WorkspaceService") as MockWorkspaceService,
        patch("app.core.auth._DEFAULT_WORKSPACE_ID", ws_id),
        patch("app.core.auth._get_workspace_role", new_callable=AsyncMock, return_value=None),
        patch("app.core.auth.membership_cache.set", cache_set),
        patch("app.core.auth.logger"),
    ):
        payload = MagicMock()
        payload.sub = existing_user.auth0_id
        payload.email = existing_user.email
        payload.name = existing_user.name
        mock_verify.return_value = payload

        user_svc = AsyncMock()
        user_svc.get_by_auth0_id.return_value = existing_user
        MockUserService.return_value = user_svc

        ws_svc = AsyncMock()
        ws_svc.set_member_role.side_effect = Exception("workspace does not exist")
        MockWorkspaceService.return_value = ws_svc

        result = await get_current_user(mock_credentials, mock_session)

        assert result == existing_user, "a failed join must not cost the user their login"
        cache_set.assert_not_awaited()
