from __future__ import annotations

from uuid import UUID

from aiocache import BaseCache, RedisCache, SimpleMemoryCache  # type: ignore[import-untyped]
from aiocache.serializers import PickleSerializer  # type: ignore[import-untyped]

from app.models.workspace import WorkspaceRole
from app.schemas.tag import TagOut
from app.schemas.user import UserOut
from app.settings import settings

# Process-local sentinel — passed as `default` to cache.get(..., default=CACHE_MISS).
# aiocache only returns this value when a key is *absent*, never when None is stored.
# This lets WorkspaceMembershipCache distinguish "cache miss" from "confirmed non-member (None)".
CACHE_MISS: object = object()

# Internal sentinel stored in place of None to represent "confirmed non-member".
# Needed because aiocache's base get() returns `default` whenever the value is None,
# making it impossible to distinguish a stored None from a cache miss without this sentinel.
_NON_MEMBER: object = object()


def _make_cache(ttl: int, namespace: str) -> BaseCache:
    if settings.cache_backend == "redis":
        return RedisCache(
            endpoint=settings.redis_host,
            port=settings.redis_port,
            ttl=ttl,
            namespace=namespace,
            serializer=PickleSerializer(),
        )
    return SimpleMemoryCache(ttl=ttl, namespace=namespace)


class UserCache:
    def __init__(self, backend: BaseCache) -> None:
        self._cache = backend

    async def get(self, auth0_id: str) -> UserOut | None:
        """Return cached UserOut or None on cache miss (None is never stored for a user)."""
        result: UserOut | None = await self._cache.get(auth0_id)
        return result

    async def set(self, auth0_id: str, user: UserOut) -> None:
        await self._cache.set(auth0_id, user)

    async def invalidate(self, auth0_id: str) -> None:
        await self._cache.delete(auth0_id)


class WorkspaceMembershipCache:
    def __init__(self, backend: BaseCache) -> None:
        self._cache = backend

    async def get(self, user_id: UUID, workspace_id: UUID) -> WorkspaceRole | None | object:
        """Return CACHE_MISS when key absent, None for confirmed non-member, or WorkspaceRole."""
        key = f"{user_id}:{workspace_id}"
        value = await self._cache.get(key, default=CACHE_MISS)
        if value is _NON_MEMBER:
            return None
        return value

    async def set(self, user_id: UUID, workspace_id: UUID, role: WorkspaceRole | None) -> None:
        # Store _NON_MEMBER instead of None: aiocache treats stored None as absent,
        # so we need a non-None sentinel to distinguish "confirmed non-member" from cache miss.
        stored = _NON_MEMBER if role is None else role
        await self._cache.set(f"{user_id}:{workspace_id}", stored)

    async def invalidate(self, user_id: UUID, workspace_id: UUID) -> None:
        await self._cache.delete(f"{user_id}:{workspace_id}")

    async def clear_all(self) -> None:
        """Flush the entire membership namespace (called on workspace delete)."""
        await self._cache.clear(namespace=self._cache.namespace)


class TagsCache:
    _KEY = "all_tags"

    def __init__(self, backend: BaseCache) -> None:
        self._cache = backend

    async def get(self) -> list[TagOut] | None:
        result: list[TagOut] | None = await self._cache.get(self._KEY)
        return result

    async def set(self, tags: list[TagOut]) -> None:
        await self._cache.set(self._KEY, tags)

    async def invalidate(self) -> None:
        await self._cache.delete(self._KEY)


# Module-level singletons — instantiated once at import time.
user_cache = UserCache(_make_cache(ttl=settings.cache_user_ttl_seconds, namespace="user"))
membership_cache = WorkspaceMembershipCache(
    _make_cache(ttl=settings.cache_membership_ttl_seconds, namespace="membership")
)
tags_cache = TagsCache(_make_cache(ttl=settings.cache_tags_ttl_seconds, namespace="tags"))
