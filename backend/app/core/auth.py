"""
Authentication module for Auth0 JWT token verification and user management.

This module provides:
- JWT token verification using Auth0's public keys (JWKS)
- Thread-safe JWKS cache with TTL expiry and stale-key retry on rotation
- Automatic user creation on first login
- FastAPI dependency for protecting endpoints with authentication
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CACHE_MISS, membership_cache, user_cache
from app.core.db import get_session
from app.core.default_workspace import get_default_workspace_id
from app.domain.enums import GroupRole, Permissions, WorkspaceRole
from app.domain.icelandic_dates import format_date
from app.repositories.posting_suspensions import PostingSuspensionRepository
from app.schemas.user import UserCreate, UserOut, UserUpdateAdmin
from app.services.content import ContentService
from app.services.groups import GroupService
from app.services.users import UserService
from app.services.workspaces import WorkspaceService
from app.settings import settings
from app.utils import get_current_datetime

logger = logging.getLogger(__name__)

# HTTPBearer extracts the token from Authorization: Bearer <token> header
security = HTTPBearer()

# Define permission hierarchy: higher = more privileged
_PERMISSION_RANK: dict[Permissions, int] = {
    Permissions.viewer: 0,
    Permissions.member: 1,
    Permissions.moderator: 2,
    Permissions.admin: 3,
}

_WORKSPACE_ROLE_RANK: dict[WorkspaceRole, int] = {
    WorkspaceRole.viewer: 0,
    WorkspaceRole.editor: 1,
    WorkspaceRole.admin: 2,
    WorkspaceRole.owner: 3,
}

_GROUP_ROLE_RANK: dict[GroupRole, int] = {
    GroupRole.viewer: 0,
    GroupRole.editor: 1,
    GroupRole.admin: 2,
    GroupRole.owner: 3,
}


# ---------------------------------------------------------------------------
# JWKS Cache
# ---------------------------------------------------------------------------


class JWKSCache:
    """
    Thread-safe JWKS cache with TTL expiry and stale-key retry.

    Two-layer defense against Auth0 key rotation:
    1. Proactive: re-fetch after TTL expires (default 60 min)
    2. Reactive: if a token's kid is not found in cache, force-refresh once
       before failing — handles the window between rotation and TTL expiry.

    The threading Lock ensures only one thread fetches at a time, preventing
    a thundering herd of requests from all hitting Auth0 simultaneously when
    the cache expires under load.
    """

    def __init__(self, ttl_minutes: int = 60) -> None:
        self._jwks: dict | None = None
        self._fetched_at: datetime | None = None
        self._ttl = timedelta(minutes=ttl_minutes)
        self._lock = Lock()

    @property
    def _is_expired(self) -> bool:
        if self._fetched_at is None:
            return True
        return datetime.now(tz=timezone.utc) - self._fetched_at > self._ttl

    def _fetch(self) -> dict:
        """
        Synchronous JWKS fetch from Auth0.

        This is intentionally sync — call via asyncio.to_thread in async context.

        Raises:
            HTTPException: 503 if Auth0 is unreachable.
        """
        jwks_url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
        try:
            response = httpx.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            logger.info("JWKS refreshed from Auth0")
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to fetch Auth0 public keys: {e}",
            ) from e

    def get(self, *, force_refresh: bool = False) -> dict:
        """
        Return cached JWKS, refreshing if expired or forced.

        Args:
            force_refresh: Bypass TTL check and fetch immediately.
                           Used when a token's kid is not found in cache,
                           which may indicate Auth0 has rotated its keys.

        Returns:
            dict: The JWKS containing Auth0's public keys.
        """
        with self._lock:
            if force_refresh or self._is_expired:
                self._jwks = self._fetch()
                self._fetched_at = datetime.now(tz=timezone.utc)
            return self._jwks  # type: ignore[return-value]


# Module-level singleton shared across all requests
jwks_cache = JWKSCache()


# ---------------------------------------------------------------------------
# Token verification
# ---------------------------------------------------------------------------


class TokenPayload(BaseModel):
    """Typed representation of a verified Auth0 JWT payload."""

    model_config = ConfigDict(extra="allow")

    sub: str
    aud: str | list[str]
    iss: str
    exp: int
    iat: int
    email: str | None = None
    name: str | None = None
    permissions: list[str] = Field(default_factory=list)


def _find_rsa_key(jwks: dict, kid: str) -> dict | None:
    """Find the RSA key matching the given kid in a JWKS response."""
    for key in jwks["keys"]:
        if key["kid"] == kid:
            return {k: key[k] for k in ("kty", "kid", "use", "n", "e")}
    return None


def verify_auth0_token(token: str) -> TokenPayload:
    """
    Verify an Auth0 JWT token and return its claims.

    Steps:
    1. Extract kid from the unverified token header
    2. Look up the matching public key in JWKS cache
    3. If kid not found, force-refresh JWKS once (handles key rotation)
    4. Validate signature, expiry, audience, and issuer
    5. Parse and return verified payload as a typed TokenPayload

    This function is synchronous and intended to be called via
    ``asyncio.to_thread`` from async FastAPI dependencies.

    Args:
        token: The raw JWT string from the Authorization header.

    Returns:
        TokenPayload: Verified token payload with typed fields.

    Raises:
        HTTPException: 401 if token is invalid, expired, or claims don't match.
                       503 if Auth0's JWKS endpoint is unreachable.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {e}",
        ) from e

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header missing kid claim",
        )

    if settings.auth_debug:
        unverified_claims = jwt.get_unverified_claims(token)
        logger.debug("Token kid: %s", kid)
        logger.debug("Token aud: %s", unverified_claims.get("aud"))
        logger.debug("Token iss: %s", unverified_claims.get("iss"))
        logger.debug("Expected aud: %s", settings.auth0_audience)
        logger.debug("Expected iss: https://%s/", settings.auth0_domain)

    # First attempt with (possibly cached) JWKS
    rsa_key = _find_rsa_key(jwks_cache.get(), kid)

    # kid not found — Auth0 may have rotated keys since last fetch
    if rsa_key is None:
        logger.warning("kid %s not found in JWKS cache, forcing refresh", kid)
        rsa_key = _find_rsa_key(jwks_cache.get(force_refresh=True), kid)

    if rsa_key is None:
        logger.error("kid %s not found in JWKS even after refresh", kid)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to find appropriate signing key",
        )

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=settings.auth0_algorithms,
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
            options={
                "verify_aud": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
            },
        )

        try:
            token_payload = TokenPayload.model_validate(payload)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token claims: {e}",
            ) from e

        if settings.auth_debug:
            logger.debug("Token verified for sub: %s", token_payload.sub)

        return token_payload

    except ExpiredSignatureError as e:
        logger.warning("Expired token: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        ) from e
    except JWTClaimsError as e:
        logger.warning("JWT claims error (likely aud/iss mismatch): %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token claims: {e}",
        ) from e
    except JWTError as e:
        logger.warning("JWT error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        ) from e


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------


# Resolved once at startup — this is a deployment-time constant
_DEFAULT_WORKSPACE_ID: UUID | None = get_default_workspace_id()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> UserOut:
    """
    FastAPI dependency that authenticates requests and returns the current user.

    This dependency:
    1. Extracts the Bearer token from the Authorization header
    2. Verifies the token with Auth0 off the event loop (asyncio.to_thread)
    3. Looks up the user in the database by auth0_id
    4. Auto-creates the user on first login via Auth0's /userinfo endpoint
    5. Returns the authenticated UserOut object

    Usage:
        @router.get("/protected")
        async def protected_endpoint(
            current_user: UserOut = Depends(get_current_user)
        ):
            return {"user_id": current_user.id}

    Args:
        credentials: Automatically injected by HTTPBearer security.
        session: Database session automatically injected.

    Returns:
        UserOut: The authenticated user.

    Raises:
        HTTPException: 401 if authentication fails, 500 if user creation fails.
    """
    token = credentials.credentials

    # Run blocking crypto work off the async event loop
    payload = await asyncio.to_thread(verify_auth0_token, token)

    auth0_id = payload.sub

    # Fast path: serve from cache — eliminates a DB round-trip on most requests
    cached_user = await user_cache.get(auth0_id)
    if cached_user is not None:
        return cached_user

    # Cache miss: look up in DB
    user_service = UserService(session)
    user = await user_service.get_by_auth0_id(auth0_id)
    if user:
        # Sync name from Auth0 if it has changed since account creation.
        # This handles cases where a post-login script updates the Auth0 profile
        # (e.g. linking email/password to a social account) after the user was
        # already created in our DB.
        name_from_token: str | None = payload.name
        if name_from_token and name_from_token != user.name:
            user = await user_service.update(user.id, UserUpdateAdmin(name=name_from_token))
        await user_cache.set(auth0_id, user)
        return user

    # New user — we need email & name to create them.
    # Some Auth0 setups include these in the access token directly.
    email: str | None = payload.email
    name: str | None = payload.name

    if not email:
        # Access tokens for API audiences don't carry email by default.
        # Fall back to /userinfo — this only happens once per new account.
        try:
            userinfo_url = f"https://{settings.auth0_domain}/userinfo"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    userinfo_url,
                    headers={"Authorization": f"Bearer {token}"},
                )
                response.raise_for_status()
                userinfo = response.json()
            email = userinfo.get("email")
            if not name:
                name = userinfo.get("name")
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to fetch user info from Auth0: {e}",
            ) from e

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to retrieve user email",
        )

    if not name:
        name = email.split("@")[0]

    user_data = UserCreate(auth0_id=auth0_id, email=email, name=name)
    try:
        user = await user_service.create(user_data)
    except HTTPException as exc:
        # Race guard: two parallel authenticated requests on first login
        # (React StrictMode double-effects, a page that fires both
        # `getCurrentUser()` and a data `fetchWithAuth(...)` simultaneously,
        # or any QR-code burst during a real event) both miss the cache
        # and DB lookup, both call `UserService.create`, one wins, and the
        # loser hits the (email, auth0_id) unique constraint which surfaces
        # here as HTTPException 409. In that case the user row exists — we
        # just need to return it. Only re-raise if the re-lookup also
        # fails, which would indicate a genuine conflict (e.g. the email
        # already belongs to a different auth0_id).
        if exc.status_code != status.HTTP_409_CONFLICT:
            raise
        user = await user_service.get_by_auth0_id(auth0_id)
        if user is None:
            raise
        logger.info(
            "User %s already created by a concurrent request — returning existing row",
            user.id,
        )

    if _DEFAULT_WORKSPACE_ID:
        try:
            ws_service = WorkspaceService(session)
            await ws_service.set_member_role(_DEFAULT_WORKSPACE_ID, user.id, WorkspaceRole.viewer)
            logger.info("Added new user %s to default workspace %s", user.id, _DEFAULT_WORKSPACE_ID)
        except Exception:
            logger.warning(
                "Failed to add new user %s to default workspace %s",
                user.id,
                _DEFAULT_WORKSPACE_ID,
                exc_info=True,
            )

    await user_cache.set(auth0_id, user)
    return user


def require_permission(minimum: Permissions) -> Callable[[UserOut], Awaitable[UserOut]]:
    """
    FastAPI dependency factory that enforces a minimum global permission level.

    Usage:
        @router.delete("/admin-only")
        async def admin_endpoint(
            current_user: UserOut = Depends(require_permission(Permissions.admin))
        ):
            ...
    """

    async def _check(
        current_user: UserOut = Depends(get_current_user),  # noqa: B008
    ) -> UserOut:
        if _PERMISSION_RANK[current_user.permissions] < _PERMISSION_RANK[minimum]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum.value}' permission or higher.",
            )
        return current_user

    return _check


# ---------------------------------------------------------------------------
# Resource-level access checks
# ---------------------------------------------------------------------------


async def _get_workspace_role(
    workspace_id: UUID, user_id: UUID, session: AsyncSession
) -> WorkspaceRole | None:
    """Return the user's workspace role from cache, falling back to DB on miss."""
    cached = await membership_cache.get(user_id, workspace_id)
    if cached is not CACHE_MISS:
        return cached  # type: ignore[return-value]  # WorkspaceRole or None (non-member)
    role = await WorkspaceService(session).find_user_role(workspace_id, user_id)
    await membership_cache.set(user_id, workspace_id, role)
    return role


async def check_workspace_access(
    workspace_id: UUID,
    current_user: UserOut,
    session: AsyncSession,
    minimum_role: WorkspaceRole,
    hide_from_non_members: bool = False,
) -> None:
    """
    Raise 403 if the user lacks the required workspace role.

    Platform admins bypass all workspace role checks.

    Args:
        hide_from_non_members: When True, raise 404 instead of 403 for users
            with no membership at all. Use on resource-level endpoints where
            returning 403 would reveal that the resource exists.
    """
    if current_user.permissions == Permissions.admin:
        return

    role = await _get_workspace_role(workspace_id, current_user.id, session)

    if role is None:
        if hide_from_non_members:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    if _WORKSPACE_ROLE_RANK[role] < _WORKSPACE_ROLE_RANK[minimum_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {minimum_role.value} role or higher",
        )


async def require_not_suspended(
    current_user: UserOut = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> UserOut:
    """Refuse a write from someone currently in skammarkrókur.

    **Not cached.** Writes are rare and this is one indexed lookup, whereas a
    cached suspension either expires late or lifts late — and someone told they
    can post again, who then cannot, will report it as broken. Correctness here
    is worth more than the round trip.

    Reading, filtering, favourites, likes and **reporting** are all untouched.
    Taking away someone's ability to flag genuinely unsafe content because they
    are themselves under review helps nobody.
    """
    suspension = await PostingSuspensionRepository(session).active_for(
        current_user.id, get_current_datetime()
    )
    if suspension is None:
        return current_user

    # An open-ended suspension has no date to name, and inventing one would be
    # a lie. Saying so plainly is better than a vague refusal.
    if suspension.expires_at is None:
        detail = "Þú getur ekki sent inn efni í bankann. Hafðu samband við Dagskrárstjórnarteymið."
        headers = {"X-Suspended-Until": "open-ended"}
    else:
        detail = (
            f"Þú getur ekki sent inn efni í bankann fram til {format_date(suspension.expires_at)}."
        )
        # ISO in the header, Icelandic in the message: one is for a machine and
        # one is for a person, and neither should have to parse the other's.
        headers = {"X-Suspended-Until": suspension.expires_at.date().isoformat()}

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail, headers=headers)


async def check_content_create_access(
    workspace_id: UUID,
    current_user: UserOut,
    session: AsyncSession,
    hide_from_non_members: bool = False,
) -> None:
    """
    Raise 403 unless the user may add content to this workspace.

    **The open bank is the exception, not the new rule.** It takes submissions
    from anyone with an account, so membership alone is enough *there*. Anywhere
    else `editor` still means what it always did and `viewer` still means
    read-only: a sveit that adds a co-leader, a parent or an outside helper as a
    viewer so they can read the plan has not agreed to let them write to it.

    Lowering this globally would have deleted the read-only role from the
    product — after it, `editor` would grant nothing that `viewer` did not.
    """
    open_to_any_member = _DEFAULT_WORKSPACE_ID is not None and workspace_id == _DEFAULT_WORKSPACE_ID
    await check_workspace_access(
        workspace_id,
        current_user,
        session,
        minimum_role=WorkspaceRole.viewer if open_to_any_member else WorkspaceRole.editor,
        hide_from_non_members=hide_from_non_members,
    )


async def check_content_edit_access(
    workspace_id: UUID,
    author_id: UUID | None,
    current_user: UserOut,
    session: AsyncSession,
    hide_from_non_members: bool = False,
) -> None:
    """
    Raise 403 unless the user is permitted to change this content.

    Allowed when the user is:
    - a platform admin, OR
    - a workspace admin (or above), OR
    - the content's own author, at any workspace role

    Governs both editing and deleting, and applies to Programs, Events and Tasks
    alike: authorship and workspace role are Content-level facts, identical for
    all three.

    **The author rule deliberately does not require `editor`.** The bank is open
    to submissions from anyone with an account, so its authors are plain
    `viewer`s — requiring `editor` would mean a leader could file an idea and
    then be unable to fix a typo in it, or withdraw it.

    Conversely, `editor` alone is no longer enough to change *someone else's*
    content. It used to be, which meant opening submissions would have let any
    member edit any item in the bank.

    A content moderator is the fourth clause: Dagskrárstjórnarteymið can change
    anything in the bank, which is what makes the Yfirferð board's hide and
    reject actions work on other people's submissions.

    Args:
        hide_from_non_members: When True, raise 404 instead of 403 for users
            with no membership at all. Use on resource-level endpoints where
            returning 403 would reveal that the resource exists.
    """
    if _PERMISSION_RANK[current_user.permissions] >= _PERMISSION_RANK[Permissions.moderator]:
        return

    role = await _get_workspace_role(workspace_id, current_user.id, session)

    if role is None:
        if hide_from_non_members:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    is_author = author_id is not None and current_user.id == author_id
    is_workspace_admin = _WORKSPACE_ROLE_RANK[role] >= _WORKSPACE_ROLE_RANK[WorkspaceRole.admin]

    if is_author or is_workspace_admin:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the author or a workspace admin can change this content",
    )


async def check_content_workspace_access(
    content_id: UUID,
    current_user: UserOut,
    session: AsyncSession,
    minimum_role: WorkspaceRole = WorkspaceRole.viewer,
) -> UUID:
    """
    Raise 404 unless the user may reach the workspace this content lives in.

    Comments and likes address content by id and never name a workspace, so
    without this a member of one workspace can write to content in another that
    they cannot even read. Returns the workspace id so the caller need not look
    it up a second time.
    """
    try:
        workspace_id = await ContentService(session).get_workspace_id(content_id)
    except HTTPException as exc:
        if exc.status_code != status.HTTP_404_NOT_FOUND:
            raise
        # The service says "Content not found" and check_workspace_access says
        # "Not found". Two different bodies behind the same status tell a caller
        # whether an id they hold still exists in a workspace they were removed
        # from — which is the one thing hide_from_non_members exists to withhold.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found") from exc
    await check_workspace_access(
        workspace_id,
        current_user,
        session,
        minimum_role=minimum_role,
        hide_from_non_members=True,
    )
    return workspace_id


async def check_group_access(
    group_id: UUID,
    current_user: UserOut,
    session: AsyncSession,
    minimum_role: GroupRole,
) -> None:
    """
    Raise 403 if the user lacks the required group role.

    Platform admins bypass all group role checks.
    """
    if current_user.permissions == Permissions.admin:
        return

    g_svc = GroupService(session)
    membership = await g_svc.get_user_membership(group_id, current_user.id)

    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a group member")

    if _GROUP_ROLE_RANK[membership.role] < _GROUP_ROLE_RANK[minimum_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {minimum_role.value} role or higher",
        )
