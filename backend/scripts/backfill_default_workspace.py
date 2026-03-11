"""
Backfill script: adds all existing users to the default workspace as viewers.

Uses a single bulk INSERT ... WHERE NOT EXISTS so the entire operation is
one round-trip to the database. Safe to run multiple times (idempotent).

Usage:
    PYTHONPATH=. uv run python scripts/backfill_default_workspace.py
    PYTHONPATH=. uv run python scripts/backfill_default_workspace.py --workspace-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from uuid import UUID

from sqlalchemy import text

from app.core.db import get_session_maker
from app.core.default_workspace import get_default_workspace_id

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)


async def backfill(workspace_id: UUID) -> int:
    """Add all non-deleted users to the workspace as viewers. Returns count of rows inserted."""
    session_maker = get_session_maker()

    async with session_maker() as session, session.begin():
        result = await session.execute(
            text("""
                INSERT INTO workspace_memberships (workspace_id, user_id, role)
                SELECT :ws_id, u.id, 'viewer'
                FROM users u
                WHERE u.deleted_at IS NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM workspace_memberships wm
                    WHERE wm.workspace_id = :ws_id AND wm.user_id = u.id
                  )
            """),
            {"ws_id": str(workspace_id)},
        )
        count = result.rowcount or 0
        # transaction committed by context-manager exit

    return count


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill default workspace memberships")
    parser.add_argument(
        "--workspace-id",
        type=str,
        default=None,
        help="Override the default workspace UUID (default: read from config)",
    )
    args = parser.parse_args()

    if args.workspace_id:
        workspace_id = UUID(args.workspace_id)
    else:
        workspace_id = get_default_workspace_id()
        if not workspace_id:
            log.error(
                "No default workspace ID configured. "
                "Set DEFAULT_WORKSPACE_ID env var or run 'make seed' first."
            )
            return

    log.info("Backfilling workspace %s ...", workspace_id)
    added = await backfill(workspace_id)
    log.info("Done. Added %d user(s) to workspace %s as viewers.", added, workspace_id)


if __name__ == "__main__":
    asyncio.run(main())
