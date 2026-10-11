"""
Deterministic fixture data for the journey tests (docs/journey-testing-in-ci.md).

Separate from `scripts/seed.py` on purpose: the dev seed is shaped by what is
useful to click around in, and changes for that reason. Journey tests assert on
exact names and ids, so they get their own data that only changes alongside the
tests that read it. Keep `frontend/e2e/support/fixtures.ts` in step with this
file; the ids and names below are the contract between them.

Every row has a fixed UUID and is written with `merge`, so running it twice
leaves the same state as running it once, including after a test has edited an
item. Content timestamps are fixed too, so sort orders are stable.

Refuses to run unless ENV=e2e: it overwrites rows by id.

Usage (inside the e2e compose stack, see docker-compose.e2e.yml):
    PYTHONPATH=. uv run python scripts/seed_e2e.py
"""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
import sys
from uuid import UUID

from sqlalchemy import update

from app.core.db import get_session_maker
from app.domain.enums import (
    EventInterval,
    Permissions,
    ReviewState,
    Weekday,
    WorkspaceRole,
)
from app.models.content import Content
from app.models.event import Event
from app.models.heidursordla import HeidursordlaPuzzle
from app.models.like import UserLikedContent
from app.models.program import Program
from app.models.task import Task
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
from app.settings import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── The contract with frontend/e2e/support/fixtures.ts ────────────────────────

BANK_WORKSPACE_ID = UUID("00000000-0000-4000-8000-0000000000b0")

SYSTEM_USER_ID = UUID("00000000-0000-4000-8000-000000000001")
OWNER_ID = UUID("00000000-0000-4000-8000-000000000002")
MEMBER_ID = UUID("00000000-0000-4000-8000-000000000003")
REVIEWER_ID = UUID("00000000-0000-4000-8000-000000000004")
# Route crawler personas (frontend/e2e/crawl/): a bank editor and a platform admin.
EDITOR_ID = UUID("00000000-0000-4000-8000-000000000005")
ADMIN_ID = UUID("00000000-0000-4000-8000-000000000006")

# Journey: program-owner-edits-from-bank
OWNER_TASK_ID = UUID("00000000-0000-4000-8000-0000000000a1")
# Journey: community-member-likes-and-shares
LIKEABLE_TASK_ID = UUID("00000000-0000-4000-8000-0000000000a2")
# Journey: reviewer-sweeps-yfirferd
UNREVIEWED_TASK_ID = UUID("00000000-0000-4000-8000-0000000000a3")

# Route crawler (frontend/e2e/crawl/): one item of each other type, liked and
# with instructions, so `/programs/[id]` renders every kind of item page; a
# hidden item, which only moderators and the author may open; the editor's own
# workspace; and a fixed id for Heiðursorðla round 1 (`/leikir/heidursordla/[puzzleId]`).
CRAWL_PROGRAM_ID = UUID("00000000-0000-4000-8000-0000000000a4")
CRAWL_EVENT_ID = UUID("00000000-0000-4000-8000-0000000000a5")
HIDDEN_TASK_ID = UUID("00000000-0000-4000-8000-0000000000a6")
EDITOR_WORKSPACE_ID = UUID("00000000-0000-4000-8000-0000000000b1")
PUZZLE_ID = UUID("00000000-0000-4000-8000-0000000000c1")

CREATED_AT = dt.datetime(2026, 1, 15, 12, 0, tzinfo=dt.timezone.utc)

USERS: list[tuple[UUID, str, str, str, Permissions, WorkspaceRole]] = [
    # id, auth0_id (= token `sub`), name, email, platform permission, bank role
    (
        SYSTEM_USER_ID,
        "slodi|system-default",
        "slodi",
        "slodi@e2e.example.com",
        Permissions.admin,
        WorkspaceRole.owner,
    ),
    (
        OWNER_ID,
        "e2e|program-owner",
        "Sigurður Prófari",
        "owner@e2e.example.com",
        Permissions.member,
        WorkspaceRole.viewer,
    ),
    (
        MEMBER_ID,
        "e2e|community-member",
        "Anna Prófari",
        "member@e2e.example.com",
        Permissions.member,
        WorkspaceRole.viewer,
    ),
    (
        REVIEWER_ID,
        "e2e|reviewer",
        "Rýnir Prófari",
        "reviewer@e2e.example.com",
        Permissions.moderator,
        WorkspaceRole.viewer,
    ),
    (
        EDITOR_ID,
        "e2e|editor",
        "Edda Prófari",
        "editor@e2e.example.com",
        Permissions.member,
        WorkspaceRole.editor,
    ),
    (
        ADMIN_ID,
        "e2e|admin",
        "Ari Prófari",
        "admin@e2e.example.com",
        Permissions.admin,
        WorkspaceRole.viewer,
    ),
]

OWNER_TASK_INSTRUCTIONS = (
    "Skiptið hópnum í tvö lið.\nHvort lið fær eitt vasaljós.\nLiðið sem finnur fánann fyrst vinnur."
)


def _task(
    id: UUID,
    name: str,
    author_id: UUID,
    review_state: ReviewState,
    *,
    instructions: str | None = None,
    media: dict | None = None,
    hidden_at: dt.datetime | None = None,
    kind: type[Content] = Task,
) -> Content:
    return kind(
        id=id,
        name=name,
        description=f"{name} — prófunargögn fyrir ferlaprófanir.",
        instructions=instructions,
        media=media,
        equipment=["Vasaljós"],
        duration_min=20,
        duration_max=40,
        count_min=6,
        count_max=30,
        created_at=CREATED_AT,
        review_state=review_state,
        # Explicit, so a re-run undoes what a test did to these columns.
        review_note=None,
        reviewed_by_id=None,
        reviewed_at=None,
        hidden_at=hidden_at,
        deleted_at=None,
        author_id=author_id,
        workspace_id=BANK_WORKSPACE_ID,
    )


async def main() -> None:
    if settings.env.strip().lower() != "e2e":
        sys.exit(f"seed_e2e.py only runs with ENV=e2e (ENV is {settings.env!r}).")

    session_maker = get_session_maker()
    async with session_maker() as session, session.begin():
        await session.merge(
            Workspace(
                id=BANK_WORKSPACE_ID,
                name="Dagskrárbankinn",
                default_meeting_weekday=Weekday.monday,
                default_start_time=dt.time(20, 0),
                default_end_time=dt.time(21, 30),
                default_interval=EventInterval.weekly,
                season_start=dt.date(2026, 9, 7),
            )
        )
        for user_id, auth0_id, name, email, permission, role in USERS:
            await session.merge(
                User(
                    id=user_id,
                    auth0_id=auth0_id,
                    name=name,
                    email=email,
                    permissions=permission,
                )
            )
            await session.flush()
            await session.merge(
                WorkspaceMembership(workspace_id=BANK_WORKSPACE_ID, user_id=user_id, role=role)
            )

        await session.merge(
            _task(
                OWNER_TASK_ID,
                "Fánaleikur í myrkri",
                OWNER_ID,
                ReviewState.approved,
                instructions=OWNER_TASK_INSTRUCTIONS,
                media={
                    "images": [],
                    "documents": [
                        {
                            "name": "Leikreglur.pdf",
                            "url": "uploads/documents/00000000-0000-4000-8000-0000000000d1/"
                            "00000000-0000-4000-8000-0000000000d2",
                            "content_type": "application/pdf",
                        }
                    ],
                },
            )
        )
        await session.merge(_task(LIKEABLE_TASK_ID, "Hnútakeppni", OWNER_ID, ReviewState.approved))
        await session.merge(
            _task(UNREVIEWED_TASK_ID, "Óyfirfarin hugmynd", MEMBER_ID, ReviewState.unreviewed)
        )

        # Route crawler fixtures.
        await session.merge(
            Workspace(
                id=EDITOR_WORKSPACE_ID,
                name="Sveitin Prófun",
                default_meeting_weekday=Weekday.wednesday,
                default_start_time=dt.time(19, 30),
                default_end_time=dt.time(21, 0),
                default_interval=EventInterval.weekly,
                season_start=dt.date(2026, 9, 7),
            )
        )
        await session.flush()
        await session.merge(
            WorkspaceMembership(
                workspace_id=EDITOR_WORKSPACE_ID, user_id=EDITOR_ID, role=WorkspaceRole.owner
            )
        )
        documents = {
            "images": [],
            "documents": [
                {
                    "name": "Gátlisti.pdf",
                    "url": "uploads/documents/00000000-0000-4000-8000-0000000000d3/"
                    "00000000-0000-4000-8000-0000000000d4",
                    "content_type": "application/pdf",
                }
            ],
        }
        await session.merge(
            _task(
                CRAWL_PROGRAM_ID,
                "Haustdagskrá fálkaskáta",
                EDITOR_ID,
                ReviewState.approved,
                instructions="Hittumst við skátaheimilið.\nFarið yfir dagskrá vetrarins.",
                media=documents,
                kind=Program,
            )
        )
        await session.merge(
            _task(
                CRAWL_EVENT_ID,
                "Næturganga á Esjuna",
                EDITOR_ID,
                ReviewState.approved,
                instructions="Mæting klukkan átta.\nTakið með höfuðljós.",
                media=documents,
                kind=Event,
            )
        )
        await session.merge(
            _task(
                HIDDEN_TASK_ID,
                "Falin hugmynd",
                MEMBER_ID,
                ReviewState.approved,
                hidden_at=CREATED_AT,
            )
        )
        await session.flush()
        for content_id in (OWNER_TASK_ID, CRAWL_PROGRAM_ID, CRAWL_EVENT_ID):
            await session.merge(UserLikedContent(user_id=REVIEWER_ID, content_id=content_id))
        # The rounds themselves come from a migration, with random ids. Pin
        # round 1's id so the crawler can open it; a fresh database has no
        # attempts that would reference the old one.
        await session.execute(
            update(HeidursordlaPuzzle)
            .where(HeidursordlaPuzzle.puzzle_number == 1)
            .values(id=PUZZLE_ID)
        )

    log.info("E2E fixtures in place (bank workspace %s)", BANK_WORKSPACE_ID)


if __name__ == "__main__":
    asyncio.run(main())
