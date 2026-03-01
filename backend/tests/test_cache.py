"""Unit tests for app.core.cache — no DB or external dependencies."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.cache import (
    CACHE_MISS,
    TagsCache,
    UserCache,
    WorkspaceMembershipCache,
    _make_cache,
)
from app.models.workspace import WorkspaceRole
from app.schemas.tag import TagOut
from app.schemas.user import UserOut

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _user(auth0_id: str = "auth0|test") -> UserOut:
    return UserOut(
        id=uuid4(),
        email="test@example.com",
        auth0_id=auth0_id,
        name="Test User",
        permissions="member",
        preferences=None,
        pronouns=None,
    )


def _tag(name: str = "nature") -> TagOut:
    return TagOut(id=uuid4(), name=name)


# ---------------------------------------------------------------------------
# UserCache
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_user_cache_miss_returns_none() -> None:
    cache = UserCache(_make_cache(ttl=60, namespace="test_user_miss"))
    result = await cache.get("auth0|nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_user_cache_set_and_get() -> None:
    cache = UserCache(_make_cache(ttl=60, namespace="test_user_set"))
    user = _user("auth0|abc")
    await cache.set("auth0|abc", user)
    result = await cache.get("auth0|abc")
    assert result is not None
    assert result.auth0_id == "auth0|abc"


@pytest.mark.asyncio
async def test_user_cache_invalidate() -> None:
    cache = UserCache(_make_cache(ttl=60, namespace="test_user_invalidate"))
    user = _user("auth0|xyz")
    await cache.set("auth0|xyz", user)
    await cache.invalidate("auth0|xyz")
    result = await cache.get("auth0|xyz")
    assert result is None


# ---------------------------------------------------------------------------
# WorkspaceMembershipCache
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_membership_cache_miss_returns_sentinel() -> None:
    cache = WorkspaceMembershipCache(_make_cache(ttl=60, namespace="test_mem_miss"))
    result = await cache.get(uuid4(), uuid4())
    assert result is CACHE_MISS


@pytest.mark.asyncio
async def test_membership_cache_set_role() -> None:
    cache = WorkspaceMembershipCache(_make_cache(ttl=60, namespace="test_mem_role"))
    user_id, ws_id = uuid4(), uuid4()
    await cache.set(user_id, ws_id, WorkspaceRole.editor)
    result = await cache.get(user_id, ws_id)
    assert result is not CACHE_MISS
    assert result == WorkspaceRole.editor


@pytest.mark.asyncio
async def test_membership_cache_stores_none_for_non_member() -> None:
    """None (non-member) must be distinguishable from CACHE_MISS (absent)."""
    cache = WorkspaceMembershipCache(_make_cache(ttl=60, namespace="test_mem_none"))
    user_id, ws_id = uuid4(), uuid4()
    await cache.set(user_id, ws_id, None)
    result = await cache.get(user_id, ws_id)
    assert result is not CACHE_MISS
    assert result is None


@pytest.mark.asyncio
async def test_membership_cache_invalidate() -> None:
    cache = WorkspaceMembershipCache(_make_cache(ttl=60, namespace="test_mem_invalidate"))
    user_id, ws_id = uuid4(), uuid4()
    await cache.set(user_id, ws_id, WorkspaceRole.viewer)
    await cache.invalidate(user_id, ws_id)
    result = await cache.get(user_id, ws_id)
    assert result is CACHE_MISS


@pytest.mark.asyncio
async def test_membership_cache_clear_all() -> None:
    cache = WorkspaceMembershipCache(_make_cache(ttl=60, namespace="test_mem_clear"))
    u1, w1 = uuid4(), uuid4()
    u2, w2 = uuid4(), uuid4()
    await cache.set(u1, w1, WorkspaceRole.owner)
    await cache.set(u2, w2, WorkspaceRole.admin)
    await cache.clear_all()
    assert await cache.get(u1, w1) is CACHE_MISS
    assert await cache.get(u2, w2) is CACHE_MISS


# ---------------------------------------------------------------------------
# TagsCache
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tags_cache_miss_returns_none() -> None:
    cache = TagsCache(_make_cache(ttl=60, namespace="test_tags_miss"))
    result = await cache.get()
    assert result is None


@pytest.mark.asyncio
async def test_tags_cache_set_and_get() -> None:
    cache = TagsCache(_make_cache(ttl=60, namespace="test_tags_set"))
    tags = [_tag("nature"), _tag("water")]
    await cache.set(tags)
    result = await cache.get()
    assert result is not None
    assert len(result) == 2
    assert {t.name for t in result} == {"nature", "water"}


@pytest.mark.asyncio
async def test_tags_cache_invalidate() -> None:
    cache = TagsCache(_make_cache(ttl=60, namespace="test_tags_invalidate"))
    await cache.set([_tag("fire")])
    await cache.invalidate()
    result = await cache.get()
    assert result is None
