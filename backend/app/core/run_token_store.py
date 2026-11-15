"""Best-effort single-use tracking for run tokens (in-memory unless CACHE_BACKEND=redis)."""

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
