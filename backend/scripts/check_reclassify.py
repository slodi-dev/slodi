"""Preview what the sc-129 migration (`d5c13784359f`) will do to this database.

Read-only. Counts the programs the migration would file as tasks, and lists the
ones it skips because events hang off them, so the numbers can be checked
against the bank before the deploy that carries the migration.

Uses the same scope guard as the migration: a program with any event pointing
at it, deleted or not, stays a program.

Usage:
    PYTHONPATH=. uv run python scripts/check_reclassify.py
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import exists, select

from app.core.db import get_session_maker

# The package, not the individual modules: SQLAlchemy needs every mapper
# registered before the first query, and this script is entered outside the
# app's own startup path.
from app.models import Content, Event, Program

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)


async def main() -> None:
    session_maker = get_session_maker()

    async with session_maker() as session:
        # Tables, not mappers: selecting a subtype mapper joins `content` again
        # and breaks the correlated EXISTS.
        programs, content, events = Program.__table__, Content.__table__, Event.__table__
        has_events = exists().where(events.c.program_id == programs.c.id)
        rows = (
            await session.execute(
                select(programs.c.id, content.c.name, has_events)
                .join(content, content.c.id == programs.c.id)
                .order_by(content.c.name)
            )
        ).all()

    reclassified = [row for row in rows if not row[2]]
    skipped = [row for row in rows if row[2]]

    log.info("Would reclassify %d program(s) as tasks.", len(reclassified))
    log.info("Would skip %d program(s) that have events:", len(skipped))
    for program_id, name, _ in skipped:
        log.info("  %s  %s", program_id, name)


if __name__ == "__main__":
    asyncio.run(main())
