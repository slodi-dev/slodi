"""Unit tests for app.core.rate_limiter — no DB or external dependencies."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from app.core.cache import _make_cache
from app.core.rate_limiter import RateLimiter, _Window

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _limiter(namespace: str) -> RateLimiter:
    """Return a RateLimiter backed by a fresh in-memory cache."""
    rl = RateLimiter.__new__(RateLimiter)
    rl._cache = _make_cache(ttl=3600, namespace=namespace)
    return rl


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_first_requests_within_limit_are_allowed() -> None:
    rl = _limiter("rl_allowed")
    limit = 3
    for _ in range(limit):
        allowed, retry_after = await rl.check("key1", limit, window_seconds=60)
        assert allowed is True
        assert retry_after == 0


@pytest.mark.asyncio
async def test_request_over_limit_is_denied() -> None:
    rl = _limiter("rl_denied")
    limit = 3
    for _ in range(limit):
        await rl.check("key2", limit, window_seconds=60)

    allowed, retry_after = await rl.check("key2", limit, window_seconds=60)
    assert allowed is False
    assert retry_after > 0


@pytest.mark.asyncio
async def test_retry_after_is_positive_integer() -> None:
    rl = _limiter("rl_retry")
    limit = 1
    await rl.check("key3", limit, window_seconds=60)
    allowed, retry_after = await rl.check("key3", limit, window_seconds=60)
    assert not allowed
    assert isinstance(retry_after, int)
    assert retry_after >= 1


@pytest.mark.asyncio
async def test_counter_resets_after_window_expires() -> None:
    rl = _limiter("rl_reset")
    limit = 2
    key = "key4"

    now = time.time()

    # Fill up the window
    with patch("app.core.rate_limiter.time") as mock_time:
        mock_time.time.return_value = now
        for _ in range(limit):
            allowed, _ = await rl.check(key, limit, window_seconds=60)
            assert allowed

        # Next request denied
        allowed, _ = await rl.check(key, limit, window_seconds=60)
        assert not allowed

        # Advance time past window expiry
        mock_time.time.return_value = now + 61

        # Counter should reset — first request in new window is allowed
        allowed, retry_after = await rl.check(key, limit, window_seconds=60)
        assert allowed is True
        assert retry_after == 0


@pytest.mark.asyncio
async def test_different_keys_have_independent_counters() -> None:
    rl = _limiter("rl_independent")
    limit = 2

    # Fill key_a to the limit
    for _ in range(limit):
        await rl.check("path_a:1.2.3.4", limit, window_seconds=60)

    # key_a should be denied
    allowed_a, _ = await rl.check("path_a:1.2.3.4", limit, window_seconds=60)
    assert not allowed_a

    # key_b (different path) should still be allowed
    allowed_b, retry_after_b = await rl.check("path_b:1.2.3.4", limit, window_seconds=60)
    assert allowed_b is True
    assert retry_after_b == 0

    # key_c (same path, different IP) should still be allowed
    allowed_c, retry_after_c = await rl.check("path_a:9.9.9.9", limit, window_seconds=60)
    assert allowed_c is True
    assert retry_after_c == 0


@pytest.mark.asyncio
async def test_count_increments_correctly() -> None:
    """Verify the window entry is updated on each request."""
    rl = _limiter("rl_count")
    limit = 5
    key = "key5"
    for i in range(1, limit + 1):
        allowed, _ = await rl.check(key, limit, window_seconds=60)
        assert allowed
        entry: _Window | None = await rl._cache.get(key)
        assert entry is not None
        assert entry.hits == i
