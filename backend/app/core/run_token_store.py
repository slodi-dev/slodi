"""
Single-use tracking for game run tokens.

A token is only burned once a score has actually been stored. Burning it on
receipt would break the parked-score flow: a player who finishes a run while
signed out gets a 401, logs in, and replays the very same run — which has to
present the very same token.

## This is best-effort, by design

The store is the shared cache, which is in-process memory unless CACHE_BACKEND
is `redis`. Under memory, a second uvicorn worker — or a restart — does not see
what the first burned, so a token can be redeemed more than once.

That is tolerable because redeeming a token twice buys nothing: the upsert keeps
only a player's best score, so a replay of the same run stores the same number,
and the elapsed-time check and the per-game ceiling already bound what any
single token can claim. Single-use is a tidiness measure on top of those two,
not the thing holding the door shut. Set CACHE_BACKEND=redis for real
enforcement across workers.
"""

from __future__ import annotations

from app.core.cache import _make_cache
from app.core.run_tokens import TOKEN_TTL_SECONDS

_used = _make_cache(ttl=TOKEN_TTL_SECONDS, namespace="runtok")


async def is_spent(nonce: str) -> bool:
    """Has a score already been recorded against this run?"""
    return await _used.get(nonce) is not None


async def spend(nonce: str) -> None:
    """Mark the run as recorded, so the token cannot be replayed for another score."""
    await _used.set(nonce, True, ttl=TOKEN_TTL_SECONDS)
