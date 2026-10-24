"""reclassify bank programs as tasks (sc-129)

Until the September release every bank submission was filed as a `program`,
whatever it was. Almost all of them are a single leikur or setning — a
verkefni — so they belong in `tasks`. A program is a collection, and the only
programs that actually collect anything are the ones with events under them.

`programs` holds nothing but its `id`, so reclassifying moves no data: insert a
`tasks` row, flip `content.content_type`, delete the `programs` row. Comments,
likes, tags and reports all hang off `content.id` and are untouched.

Programs with any event pointing at them, deleted or not, stay programs:
`events.program_id` references `programs.id`, and a program with events is a
real collection.

`reclassified_programs` records which ids were flipped. Without it `downgrade`
cannot tell a reclassified task from one that was created as a task.

Revision ID: d5c13784359f
Revises: c3a7e5d2f019
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d5c13784359f"
down_revision: str | Sequence[str] | None = "c3a7e5d2f019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reclassified_programs",
        sa.Column(
            "content_id",
            sa.UUID(),
            sa.ForeignKey("content.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "reclassified_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.execute(
        """
        INSERT INTO reclassified_programs (content_id)
        SELECT p.id FROM programs p
        WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.program_id = p.id)
        """
    )
    op.execute(
        "INSERT INTO tasks (id, event_id) SELECT content_id, NULL FROM reclassified_programs"
    )
    op.execute(
        """
        UPDATE content SET content_type = 'task'
        FROM reclassified_programs r
        WHERE content.id = r.content_id
        """
    )
    op.execute(
        "DELETE FROM programs USING reclassified_programs r WHERE programs.id = r.content_id"
    )


def downgrade() -> None:
    """Turn the recorded tasks back into programs.

    A reclassified task that has since been placed under an event is now used
    as a task, and a program cannot have an `event_id`, so it stays a task
    rather than losing its place.
    """
    op.execute(
        """
        DELETE FROM reclassified_programs r
        USING tasks t
        WHERE r.content_id = t.id AND t.event_id IS NOT NULL
        """
    )
    op.execute("INSERT INTO programs (id) SELECT content_id FROM reclassified_programs")
    op.execute(
        """
        UPDATE content SET content_type = 'program'
        FROM reclassified_programs r
        WHERE content.id = r.content_id
        """
    )
    op.execute("DELETE FROM tasks USING reclassified_programs r WHERE tasks.id = r.content_id")
    op.drop_table("reclassified_programs")
