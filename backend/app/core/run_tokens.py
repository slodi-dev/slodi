"""Signed, timestamped tokens that pace game score submissions."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from typing import Final

from app.settings import settings

# Long enough to log in before submitting a parked run
TOKEN_TTL_SECONDS: Final[int] = 12 * 60 * 60

_SEPARATOR: Final[str] = "."


class RunTokenError(Exception):
    """A token was missing, malformed, expired, or not this user's."""


# Development only, not a secret
_DEV_KEY: Final[bytes] = b"slodi-run-tokens-development-only"


def _secret() -> bytes:
    """GAME_TOKEN_SECRET, or the dev key in development."""
    if settings.game_token_secret:
        return settings.game_token_secret.encode()

    if settings.env == "development":
        return _DEV_KEY

    raise RuntimeError(
        "GAME_TOKEN_SECRET must be set outside development. It signs game run "
        "tokens and must be identical across workers. Generate one with: "
        "python -c 'import secrets; print(secrets.token_urlsafe(32))'"
    )


def _sign(payload: str) -> str:
    digest = hmac.new(_secret(), payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def issue(game_slug: str) -> str:
    """Token for the start of a run; not tied to a user so signed-out runs can be saved."""
    nonce = secrets.token_urlsafe(9)
    payload = f"{game_slug}{_SEPARATOR}{int(time.time())}{_SEPARATOR}{nonce}"
    return f"{payload}{_SEPARATOR}{_sign(payload)}"


def verify(token: str, game_slug: str) -> tuple[float, str]:
    """Return (seconds since issue, nonce); constant-time signature check."""
    parts = token.split(_SEPARATOR)
    if len(parts) != 4:
        raise RunTokenError("malformed run token")

    token_game, issued_raw, nonce, signature = parts
    payload = _SEPARATOR.join(parts[:3])

    if not hmac.compare_digest(signature, _sign(payload)):
        raise RunTokenError("bad run token signature")
    # Checked after the signature so an attacker learns nothing from the order.
    if token_game != game_slug:
        raise RunTokenError("run token is for another game")

    try:
        issued_at = int(issued_raw)
    except ValueError as exc:
        raise RunTokenError("malformed run token timestamp") from exc

    elapsed = time.time() - issued_at
    if elapsed < 0:
        # Clock skew between workers; treat as no time having passed.
        elapsed = 0.0
    if elapsed > TOKEN_TTL_SECONDS:
        raise RunTokenError("run token expired")

    return elapsed, nonce
