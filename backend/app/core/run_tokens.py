"""
Signed run tokens for scored games.

A leaderboard score is computed on the player's own machine, so it can never be
made unforgeable — anything the client can compute, the client can lie about.
What a run token buys is that a score costs *real elapsed time*: the server
stamps the start of a run, signs it, and refuses a submission that claims more
points than could have been played since that stamp.

That turns the one-line console attack

    fetch("/api/leikir/laddi-bird/scores", {method: "POST", body: '{"score": 999999999}'})

into "obtain a token, then wait 1.6 seconds per point you want to claim" — which
caps the rate of forgery rather than preventing it. Combined with the per-game
plausibility ceiling, the worst a cheat can do is claim a humanly-possible score
after spending a humanly-possible amount of time, and an admin can delete it.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from typing import Final

from app.settings import settings

#: How long a token stays valid. Generous, because a player who finishes a run
#: while signed out has to log in — a round trip through Auth0 — before the
#: score can be submitted, and that parked run still carries this token.
TOKEN_TTL_SECONDS: Final[int] = 12 * 60 * 60

_SEPARATOR: Final[str] = "."


class RunTokenError(Exception):
    """A token was missing, malformed, expired, or not this user's."""


#: Dev-only fallback key. Not a secret, and deliberately so — see _secret().
_DEV_KEY: Final[bytes] = b"slodi-run-tokens-development-only"


def _secret() -> bytes:
    """
    Signing key, shared by every worker.

    GAME_TOKEN_SECRET is the only real source. It must be the *same* value in
    every worker: a per-process random key would sign tokens that a different
    worker cannot verify, so scores would fail at random behind a load balancer.

    It must also not be derived from another credential. An earlier version of
    this derived it from DB_PASSWORD, which was a mistake worth spelling out:
    /games/{slug}/runs is unauthenticated, the derivation is public in this
    repository, and the signed payload is known — so every token handed out was
    a free offline oracle for brute-forcing the database password. A signing key
    that anyone can collect signatures under has to be dedicated to that job.

    Outside development the variable is therefore required, and startup fails
    loudly rather than quietly signing with something guessable.
    """
    configured = getattr(settings, "game_token_secret", "") or ""
    if configured:
        return configured.encode()

    if settings.env.lower() in {"dev", "development", "local", "test"}:
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
    """
    Mint a token marking the start of a run, stamped with server time.

    Deliberately *not* bound to a user, and mintable without a session. What the
    token proves is when the run began, which is what paces a forgery — and a
    player who is signed out has to be able to obtain one, or their run cannot
    be saved after they log in. Binding to a user would add nothing (an attacker
    can mint their own) while breaking that flow entirely.
    """
    nonce = secrets.token_urlsafe(9)
    payload = f"{game_slug}{_SEPARATOR}{int(time.time())}{_SEPARATOR}{nonce}"
    return f"{payload}{_SEPARATOR}{_sign(payload)}"


def verify(token: str, game_slug: str) -> tuple[float, str]:
    """
    Check a token and return (seconds_elapsed_since_issue, nonce).

    Raises RunTokenError for anything untrusted. The signature is compared with
    hmac.compare_digest so a forged token cannot be tuned byte by byte against
    response timing.
    """
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
