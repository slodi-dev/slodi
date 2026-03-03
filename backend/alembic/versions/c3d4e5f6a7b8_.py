"""move workspace_id to content, make task event_id nullable

Revision ID: c3d4e5f6a7b8
Revises: abd31343eed5
Create Date: 2026-03-02 21:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "abd31343eed5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add workspace_id to content (nullable first for backfill)
    op.add_column(
        "content",
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # 2. Backfill: programs → content
    op.execute(
        "UPDATE content SET workspace_id = p.workspace_id FROM programs p WHERE p.id = content.id"
    )

    # 3. Backfill: events → content
    op.execute(
        "UPDATE content SET workspace_id = e.workspace_id FROM events e WHERE e.id = content.id"
    )

    # 4. Backfill: tasks → content (via task's event)
    op.execute(
        """
        UPDATE content
        SET workspace_id = e.workspace_id
        FROM tasks t
        JOIN events e ON e.id = t.event_id
        WHERE content.id = t.id
        """
    )

    # 5. Set NOT NULL on content.workspace_id
    op.alter_column("content", "workspace_id", nullable=False)

    # 6. Add FK constraint content.workspace_id → workspaces.id
    op.create_foreign_key(
        "fk_content_workspace_id",
        "content",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # 7. Add index on content.workspace_id
    op.create_index("ix_content_workspace_id", "content", ["workspace_id"])

    # 8. Drop composite FK constraint from events
    op.drop_constraint("fk_event_program_workspace_program", "events", type_="foreignkey")

    # 9. Drop workspace_id from events
    op.drop_column("events", "workspace_id")

    # 10. Drop UniqueConstraint from programs
    op.drop_constraint("uq_program_workspace_id_id", "programs", type_="unique")

    # 11. Drop workspace_id from programs
    op.drop_column("programs", "workspace_id")

    # 12. Drop existing FK on tasks.event_id (ondelete=CASCADE)
    op.drop_constraint("tasks_event_id_fkey", "tasks", type_="foreignkey")

    # 13. Make tasks.event_id nullable
    op.alter_column("tasks", "event_id", nullable=True)

    # 14. Re-add FK on tasks.event_id with SET NULL
    op.create_foreign_key(
        "tasks_event_id_fkey",
        "tasks",
        "events",
        ["event_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Reverse in reverse order

    # 14/13/12. Restore tasks.event_id as non-nullable FK with CASCADE
    op.drop_constraint("tasks_event_id_fkey", "tasks", type_="foreignkey")
    op.alter_column("tasks", "event_id", nullable=False)
    op.create_foreign_key(
        "tasks_event_id_fkey",
        "tasks",
        "events",
        ["event_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 11/10. Restore workspace_id on programs
    op.add_column(
        "programs",
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        "UPDATE programs SET workspace_id = c.workspace_id FROM content c WHERE c.id = programs.id"
    )
    op.alter_column("programs", "workspace_id", nullable=False)
    op.create_unique_constraint(
        "uq_program_workspace_id_id", "programs", ["workspace_id", "id"]
    )
    op.create_foreign_key(
        "programs_workspace_id_fkey",
        "programs",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 9/8. Restore workspace_id on events and composite FK
    op.add_column(
        "events",
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        "UPDATE events SET workspace_id = c.workspace_id FROM content c WHERE c.id = events.id"
    )
    op.alter_column("events", "workspace_id", nullable=False)
    op.create_foreign_key(
        "events_workspace_id_fkey",
        "events",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_event_program_workspace_program",
        "events",
        "programs",
        ["workspace_id", "program_id"],
        ["workspace_id", "id"],
        ondelete="RESTRICT",
        deferrable=True,
        initially="DEFERRED",
    )

    # 7/6/5. Drop index, FK, and column from content
    op.drop_index("ix_content_workspace_id", table_name="content")
    op.drop_constraint("fk_content_workspace_id", "content", type_="foreignkey")
    op.drop_column("content", "workspace_id")
