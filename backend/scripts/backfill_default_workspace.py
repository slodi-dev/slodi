"""Add every existing account to the default workspace as a viewer.

Membership of the default workspace is what makes the dagskrárbanki readable and
submittable. It is arranged at login by
`app.core.auth._ensure_default_workspace_membership`, but that only heals an
account the next time its owner signs in. This script closes the gap in one
statement, so opening submissions does not depend on everyone logging in first.

Idempotent, and safe to run against a live database: one `INSERT ... WHERE NOT
EXISTS`, so it never touches a row that already has a membership and never
downgrades somebody who is an admin or owner of the bank.

Usage:
    PYTHONPATH=. uv run python scripts/backfill_default_workspace.py
    PYTHONPATH=. uv run python scripts/backfill_default_workspace.py --workspace-id <uuid>
    PYTHONPATH=. uv run python scripts/backfill_default_workspace.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func, select

if TYPE_CHECKING:
    pass

from app.core.db import get_session_maker
from app.core.default_workspace import get_default_workspace_id

# The package, not the individual modules: SQLAlchemy needs every mapper
# registered before the first query, and this script is entered outside the
# app's own startup path.
from app.models import Workspace
from app.repositories.workspaces import WorkspaceRepository
from app.services.workspaces import WorkspaceService

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)


async def backfill(workspace_id: UUID, *, dry_run: bool = False) -> int:
    """Return how many users were added — or would be, under --dry-run."""
    session_maker = get_session_maker()

    async with session_maker() as session:
        exists = await session.scalar(
            select(func.count()).select_from(Workspace).where(Workspace.id == workspace_id)
        )
        if not exists:
            # Worth failing loudly. A configured workspace that is not in the
            # database is the exact shape of the bug this script exists to fix,
            # and silently adding nobody would look like success.
            raise SystemExit(
                f"Workspace {workspace_id} does not exist. "
                "Check DEFAULT_WORKSPACE_ID or seed_output.json against the database."
            )

        if dry_run:
            return await WorkspaceRepository(session).count_users_missing_from(workspace_id)

        return await WorkspaceService(session).enroll_all_users_as_viewers(workspace_id)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill default workspace memberships")
    parser.add_argument(
        "--workspace-id",
        type=str,
        default=None,
        help="Override the default workspace UUID (default: read from config)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report how many users would be added, and change nothing",
    )
    args = parser.parse_args()

    if args.workspace_id:
        workspace_id = UUID(args.workspace_id)
    else:
        resolved = get_default_workspace_id()
        if not resolved:
            raise SystemExit(
                "No default workspace configured. "
                "Set DEFAULT_WORKSPACE_ID or run 'make seed' first."
            )
        workspace_id = resolved

    count = await backfill(workspace_id, dry_run=args.dry_run)
    if args.dry_run:
        log.info("Would add %d user(s) to workspace %s.", count, workspace_id)
    else:
        log.info("Added %d user(s) to workspace %s as viewers.", count, workspace_id)


if __name__ == "__main__":
    asyncio.run(main())
