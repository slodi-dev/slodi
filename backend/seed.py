"""
Seed script: creates the default 'slodi' system user and
the 'Dagskrárbankinn' workspace, then persists their IDs to seed_output.json.

Usage:
    PYTHONPATH=. uv run python seed.py
or via the Makefile:
    make seed
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session_maker
from app.models.tag import Tag
from app.models.user import Permissions, User
from app.models.workspace import EventInterval, Weekday, Workspace, WorkspaceMembership, WorkspaceRole

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

SLODI_AUTH0_ID = "slodi|system-default"
SLODI_NAME = "slodi"
SLODI_EMAIL = "slodi@slodi.is"

WORKSPACE_NAME = "Dagskrárbankinn"

DEFAULT_TAGS = ["Leikir", "Útivist", "Samfélagsverkefni"]

OUTPUT_FILE = Path(__file__).parent / "seed_output.json"


# ── Helpers ────────────────────────────────────────────────────────────────────


async def get_or_create_user(session: AsyncSession) -> User:
    result = await session.execute(select(User).where(User.auth0_id == SLODI_AUTH0_ID))
    user = result.scalars().first()

    if user:
        log.info("User '%s' already exists  (id=%s)", SLODI_NAME, user.id)
        return user

    user = User(
        auth0_id=SLODI_AUTH0_ID,
        name=SLODI_NAME,
        email=SLODI_EMAIL,
        permissions=Permissions.admin,
    )
    session.add(user)
    await session.flush()  # populate user.id without committing yet
    log.info("Created user '%s'  (id=%s)", SLODI_NAME, user.id)
    return user


def _first_monday_of_september() -> dt.date:
    year = dt.date.today().year
    sep1 = dt.date(year, 9, 1)
    days_to_monday = (7 - sep1.weekday()) % 7
    return sep1 + dt.timedelta(days=days_to_monday)


async def get_or_create_workspace(session: AsyncSession, user: User) -> Workspace:
    # Check if a workspace with this name already belongs to the user.
    result = await session.execute(
        select(Workspace)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(
            WorkspaceMembership.user_id == user.id,
            Workspace.name == WORKSPACE_NAME,
        )
    )
    ws = result.scalars().first()

    if ws:
        log.info("Workspace '%s' already exists  (id=%s)", WORKSPACE_NAME, ws.id)
        return ws

    ws = Workspace(
        name=WORKSPACE_NAME,
        default_meeting_weekday=Weekday.monday,
        default_start_time=dt.time(hour=20, minute=0),
        default_end_time=dt.time(hour=21, minute=30),
        default_interval=EventInterval.weekly,
        season_start=_first_monday_of_september(),
    )
    session.add(ws)
    await session.flush()  # populate ws.id

    membership = WorkspaceMembership(
        user_id=user.id,
        workspace_id=ws.id,
        role=WorkspaceRole.owner,
    )
    session.add(membership)
    log.info("Created workspace '%s'  (id=%s)", WORKSPACE_NAME, ws.id)
    return ws


async def get_or_create_tags(session: AsyncSession) -> list[Tag]:
    tags = []
    for name in DEFAULT_TAGS:
        result = await session.execute(select(Tag).where(Tag.name == name))
        tag = result.scalars().first()
        if tag:
            log.info("Tag '%s' already exists  (id=%s)", name, tag.id)
        else:
            tag = Tag(name=name)
            session.add(tag)
            await session.flush()
            log.info("Created tag '%s'  (id=%s)", name, tag.id)
        tags.append(tag)
    return tags


# ── Main ───────────────────────────────────────────────────────────────────────


async def main() -> None:
    session_maker = get_session_maker()

    async with session_maker() as session:
        async with session.begin():
            user = await get_or_create_user(session)
            ws = await get_or_create_workspace(session, user)
            tags = await get_or_create_tags(session)
        # transaction committed by context-manager exit

    output = {
        "slodi_user_id": str(user.id),
        "dagskrarbankinn_workspace_id": str(ws.id),
        "tags": {tag.name: str(tag.id) for tag in tags},
    }

    OUTPUT_FILE.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    log.info("Saved IDs to %s", OUTPUT_FILE)
    log.info("  slodi_user_id                 = %s", output["slodi_user_id"])
    log.info("  dagskrarbankinn_workspace_id  = %s", output["dagskrarbankinn_workspace_id"])


if __name__ == "__main__":
    asyncio.run(main())
