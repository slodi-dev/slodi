from __future__ import annotations

import time
from collections.abc import Callable
from typing import NamedTuple

from fastapi import HTTPException, Request, status

from app.core.cache import _make_cache
from app.settings import settings


class _Window(NamedTuple):
    hits: int
    expires_at: float


class RateLimiter:
    def __init__(self) -> None:
        self._cache = _make_cache(ttl=settings.rate_limit_max_window_seconds, namespace="rl")

    async def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds). retry_after is 0 when allowed."""
        now = time.time()
        entry: _Window | None = await self._cache.get(key)

        if entry is None or now >= entry.expires_at:
            expires_at = now + window_seconds
            await self._cache.set(key, _Window(hits=1, expires_at=expires_at), ttl=window_seconds)
            return True, 0

        if entry.hits >= limit:
            retry_after = max(1, int(entry.expires_at - now))
            return False, retry_after

        remaining_ttl = max(1, int(entry.expires_at - now))
        await self._cache.set(
            key,
            _Window(hits=entry.hits + 1, expires_at=entry.expires_at),
            ttl=remaining_ttl,
        )
        return True, 0


# Module-level singleton
rate_limiter = RateLimiter()


def ip_rate_limit(limit: int, window_seconds: int) -> Callable:
    """FastAPI dependency factory for IP-based rate limiting (public endpoints)."""

    async def dependency(request: Request) -> None:
        client_host = request.client.host if request.client else "unknown"
        key = f"{request.url.path}:{client_host}"
        allowed, retry_after = await rate_limiter.check(key, limit, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
