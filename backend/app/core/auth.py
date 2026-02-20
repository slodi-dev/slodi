"""
Authentication module for Auth0 JWT token verification and user management.

This module provides:
- JWT token verification using Auth0's public keys (JWKS)
- Automatic user creation on first login
- FastAPI dependency for protecting endpoints with authentication
"""

import logging
from functools import lru_cache
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_session
from app.models.group import GroupRole
from app.models.user import Permissions
from app.models.workspace import WorkspaceRole
from app.schemas.user import UserCreate, UserOut
from app.services.groups import GroupService
from app.services.users import UserService
from app.services.workspaces import WorkspaceService

# Setup logging
logger = logging.getLogger(__name__)

# HTTPBearer extracts the token from Authorization: Bearer <token> header
security = HTTPBearer()

# Define permission hierarchy: higher = more privileged
_PERMISSION_RANK: dict[Permissions, int] = {
    Permissions.viewer: 0,
    Permissions.member: 1,
    Permissions.admin: 2,
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


@lru_cache
def get_auth0_jwks() -> dict:
    """
    Fetch and cache Auth0 public keys (JWKS) for JWT verification.

    The JWKS (JSON Web Key Set) contains the public keys used by Auth0
    to sign JWT tokens. We cache this to avoid fetching on every request.

    Returns:
        dict: The JWKS response containing public keys

    Raises:
        HTTPException: If unable to fetch JWKS from Auth0
    """
    jwks_url = f"https://{settings.auth0_domain}/.well-known/jwks.json"

    try:
        response = httpx.get(jwks_url, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch Auth0 public keys: {str(e)}",
        ) from e


def verify_auth0_token(token: str) -> dict:
    """
    Verify Auth0 JWT token and extract claims.

    This function:
    1. Gets the unverified header to find which key to use (kid)
    2. Fetches Auth0's JWKS and finds the matching public key
    3. Validates the JWT signature using the public key
    4. Checks token expiration, audience, and issuer
    5. Returns the verified token payload (claims)

    Args:
        token: The JWT token string from Authorization header

    Returns:
        dict: The verified token payload containing user claims
              (sub=auth0_id, email, name, etc.)

    Raises:
        HTTPException: If token is invalid, expired, or verification fails
    """
    # Toggle this to enable/disable debug logging for token verification
    DEBUG_AUTH = False

    try:
        if DEBUG_AUTH:
            logger.info("=== Token Verification Debug ===")
            logger.info(f"Token length: {len(token)}")
            logger.info(f"Token starts with: {token[:30]}...")

        # Get unverified header to find which key to use
        unverified_header = jwt.get_unverified_header(token)

        if DEBUG_AUTH:
            logger.info(f"Unverified header: {unverified_header}")
            # Decode token without verification to see claims
            unverified_claims = jwt.get_unverified_claims(token)
            logger.info(f"Token audience (aud): {unverified_claims.get('aud')}")
            logger.info(f"Token issuer (iss): {unverified_claims.get('iss')}")
            logger.info(f"Expected audience: {settings.auth0_audience}")
            logger.info(f"Expected issuer: https://{settings.auth0_domain}/")

        # Get the key from JWKS
        jwks = get_auth0_jwks()
        rsa_key = {}

        # Find the key that matches the token's kid (key ID)
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            logger.error("Unable to find appropriate signing key")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate signing key",
            )

        if DEBUG_AUTH:
            logger.info("RSA key found, attempting to decode token...")

        # Verify the token signature and claims
        # Note: Auth0 tokens may have multiple audiences (API + userinfo endpoint)
        # python-jose handles this by checking if our audience is in the list
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

        if DEBUG_AUTH:
            logger.info(f"Token verified successfully! User: {payload.get('sub')}")
        return payload

    except ExpiredSignatureError as e:
        logger.error(f"Token expired: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
        ) from e
    except JWTClaimsError as e:
        logger.error(f"JWT claims error: {str(e)}")
        logger.error("This usually means audience or issuer mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token claims: {str(e)}"
        ) from e
    except JWTError as e:
        logger.error(f"JWT error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}"
        ) from e
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token verification failed: {str(e)}"
        ) from e


def require_permission(minimum: Permissions):
    """Enforce minimum global permission level."""

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


async def check_workspace_access(
    workspace_id: UUID,
    current_user: UserOut,
    session: AsyncSession,
    minimum_role: WorkspaceRole,
) -> None:
    """Raise 403 if user lacks required workspace role."""
    if current_user.permissions == Permissions.admin:
        return  # Platform admins bypass

    ws_svc = WorkspaceService(session)
    membership = await ws_svc.get_user_membership(workspace_id, current_user.id)

    if not membership:
        raise HTTPException(status_code=403, detail="Not a workspace member")

    if _WORKSPACE_ROLE_RANK[membership.role] < _WORKSPACE_ROLE_RANK[minimum_role]:
        raise HTTPException(status_code=403, detail=f"Requires {minimum_role.value} role")


async def check_group_access(
    group_id: UUID,
    current_user: UserOut,
    session: AsyncSession,
    minimum_role: GroupRole,
) -> None:
    """Raise 403 if user lacks required group role."""
    if current_user.permissions == Permissions.admin:
        return  # Platform admins bypass

    g_svc = GroupService(session)
    membership = await g_svc.get_user_membership(group_id, current_user.id)

    if not membership:
        raise HTTPException(status_code=403, detail="Not a group member")

    if _GROUP_ROLE_RANK[membership.role] < _GROUP_ROLE_RANK[minimum_role]:
        raise HTTPException(status_code=403, detail=f"Requires {minimum_role.value} role")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> UserOut:
    """
    FastAPI dependency that authenticates requests and returns the current user.

    This dependency:
    1. Extracts the Bearer token from the Authorization header
    2. Verifies the token with Auth0 (signature, expiration, claims)
    3. Extracts user information from the verified token
    4. Looks up the user in the database by auth0_id
    5. Auto-creates the user if this is their first login
    6. Returns the authenticated User object

    Usage:
        @router.get("/protected")
        async def protected_endpoint(
            current_user: User = Depends(get_current_user)
        ):
            # current_user is guaranteed to be authenticated
            return {"user_id": current_user.id}

    Args:
        credentials: Automatically injected by HTTPBearer security
        session: Database session automatically injected

    Returns:
        UserOut: The authenticated UserOut object

    Raises:
        HTTPException: If authentication fails (invalid token, etc.)
    """
    token = credentials.credentials

    # Verify token and get claims
    payload = verify_auth0_token(token)

    # Extract user info from verified token
    auth0_id = payload.get("sub")
    email = payload.get("email")
    name = payload.get("name")

    if not auth0_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing required claim (sub)"
        )

    # If email is missing from token, fetch it from Auth0 userinfo endpoint
    if not email:
        try:
            userinfo_url = f"https://{settings.auth0_domain}/userinfo"
            response = httpx.get(
                userinfo_url, headers={"Authorization": f"Bearer {token}"}, timeout=10.0
            )
            response.raise_for_status()
            userinfo = response.json()
            email = userinfo.get("email")
            if not name:
                name = userinfo.get("name")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to fetch user info from Auth0: {str(e)}",
            ) from e

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to retrieve user email"
        )

    # Use email as fallback for name if still not set
    if not name:
        name = email

    # Get or create user
    user_service = UserService(session)
    user = await user_service.get_by_auth0_id(auth0_id)

    if not user:
        # Auto-create user on first login (SAFE because token is verified)
        user_data = UserCreate(auth0_id=auth0_id, email=email, name=name)
        user = await user_service.create(user_data)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user"
            )

    return user
