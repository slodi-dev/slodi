# 001 — Ensure every user has access to the default workspace

**Status:** Open

## Problem

New users are automatically added to the default workspace ("Dagskrarbankinn") on first login via `get_current_user()` in `backend/app/core/auth.py`. However, the membership add **only runs in the first-login code path** (new user creation). Returning users and cached users skip it entirely. Users created before this feature was added — or whose auto-add silently failed — will never get default workspace access.

## Failure paths

| # | Scenario | Likelihood | Impact |
|---|----------|-----------|--------|
| 1 | `DEFAULT_WORKSPACE_ID` env var missing AND no `seed_output.json` | Medium | All new users get no workspace |
| 2 | `seed_output.json` corrupt or missing key | Low | Same as #1 |
| 3 | `add_member` IntegrityError (duplicate PK) | Low | Silent failure, logged as warning |
| 4 | Default workspace deleted (stale ID in config) | Low | FK violation, silent failure |
| 5 | User creation fails (duplicate email/auth0_id) | Low | Auth error, no user created at all |
| **6** | **Returning user (subsequent logins)** | **High** | **Membership never re-checked** |
| **7** | **Cached user (fast path)** | **High** | **All workspace logic skipped** |
| 8 | Auth0 `/userinfo` unreachable during first login | Rare | Auth fails entirely |

**Paths 6 and 7 are the critical gaps.** In `get_current_user()`:
- Cached users return at `auth.py:341` — no workspace logic runs.
- Returning users (DB hit) return at `auth.py:348` — no workspace logic runs.
- Only the new-user branch (`auth.py:394-402`) calls `add_member`.

## Current behaviour (detailed)

### `_get_default_workspace_id()` (`auth.py:287-297`)
- Reads `DEFAULT_WORKSPACE_ID` env var, falls back to `seed_output.json` key `dagskrarbankinn_workspace_id`.
- All exceptions suppressed via `contextlib.suppress(Exception)`.
- Returns `None` if neither source is available — silently disabling the feature.

### `get_current_user()` — new user path (`auth.py:394-402`)
```python
default_ws_id = _get_default_workspace_id()
if default_ws_id:
    try:
        ws_service = WorkspaceService(session)
        await ws_service.add_member(default_ws_id, user.id, WorkspaceRole.viewer)
    except Exception:
        logger.warning(
            "Failed to add new user %s to default workspace %s", user.id, default_ws_id
        )
```
- Broad `except Exception` swallows all errors — including the actual exception details.
- No retry, no cache invalidation after success, no idempotency.

### `add_member()` — no duplicate handling (`workspaces.py:94-99`)
- Raw insert of `WorkspaceMembership`. No `ON CONFLICT` or pre-check via `get_user_membership()`.
- Duplicate attempts raise `IntegrityError` on the composite PK.

### `seed.py` — idempotent (no issue here)
- `get_or_create_workspace()` and `get_or_create_user()` both check before creating.
- Re-seeding is safe.

## Desired behaviour

Every registered user should always be a member of the default workspace (at least `viewer` role):

1. Brand-new users signing up for the first time.
2. Existing users created before this feature was implemented.
3. Users whose auto-add failed silently during registration.
4. Returning users whose membership was somehow removed.

## Proposed approach

### A. Login-time ensure (prevents future gaps)

Add an `ensure_default_workspace_member()` helper called from **all three** return paths in `get_current_user()`:

```python
async def ensure_default_workspace_member(session: AsyncSession, user_id: UUID) -> None:
    default_ws_id = _get_default_workspace_id()
    if not default_ws_id:
        return

    # Fast path: check cache
    cached = await membership_cache.get(user_id, default_ws_id)
    if cached is not CACHE_MISS:
        return  # Already verified (member or confirmed non-applicable)

    # Check DB
    repo = WorkspaceRepository(session)
    existing = await repo.get_user_membership(default_ws_id, user_id)
    if existing:
        await membership_cache.set(user_id, default_ws_id, existing.role)
        return

    # Add membership
    try:
        await repo.add_member(default_ws_id, user_id, WorkspaceRole.viewer)
        await session.commit()
        await membership_cache.set(user_id, default_ws_id, WorkspaceRole.viewer)
    except IntegrityError:
        await session.rollback()
        logger.debug("User %s already member of default workspace %s", user_id, default_ws_id)
```

**Performance:** The `membership_cache` check makes this a no-op on subsequent requests. First request per user does one DB query at most.

### B. Backfill migration (fixes existing users)

An Alembic data migration that inserts `viewer` memberships for all users not currently in the default workspace:

```sql
INSERT INTO workspace_memberships (workspace_id, user_id, role)
SELECT '<DEFAULT_WORKSPACE_ID>'::uuid, u.id, 'viewer'
FROM users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM workspace_memberships wm
    WHERE wm.user_id = u.id
      AND wm.workspace_id = '<DEFAULT_WORKSPACE_ID>'::uuid
  );
```

### C. Minor fixes

- Log the actual exception in the catch block, not just a generic message.
- Invalidate `membership_cache` after successful `add_member`.
- Consider making `add_member` idempotent (upsert or check-then-insert) in the repository layer.

**Recommendation:** Implement both A and B. A prevents recurrence, B fixes the past.

## Diagnostic SQL

```sql
-- Users missing default workspace membership
SELECT u.id, u.email, u.created_at
FROM users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM workspace_memberships wm
    WHERE wm.user_id = u.id
      AND wm.workspace_id = '<DEFAULT_WORKSPACE_ID>'::uuid
  );

-- Users with no workspace memberships at all
SELECT u.id, u.email, u.created_at
FROM users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM workspace_memberships wm
    WHERE wm.user_id = u.id
  );
```

## Files of interest

- `backend/app/core/auth.py:287-297` — `_get_default_workspace_id()`
- `backend/app/core/auth.py:300-405` — `get_current_user()` (all three return paths)
- `backend/app/core/cache.py:52-75` — `membership_cache` (needs invalidation after add)
- `backend/app/models/workspace.py:112-138` — `WorkspaceMembership` model (composite PK)
- `backend/app/repositories/workspaces.py:94-108` — `add_member()` and `get_user_membership()`
- `backend/app/services/workspaces.py:65-67` — `add_member()` (no IntegrityError handling)
- `backend/seed.py` — default workspace creation (already idempotent)
