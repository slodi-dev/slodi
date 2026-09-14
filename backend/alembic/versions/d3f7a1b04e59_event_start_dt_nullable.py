"""events.start_dt is nullable — the bank holds templates, not occurrences

A Viðburður in the dagskrárbanki is a pattern someone may run in March or in
September. The column was NOT NULL and the create schema defaulted it to
`now()`, so every bank submission silently carried a date its author never
chose and sorted as if it happened the day it was written.

Shared with the planner track, which needs the same nullability for its
"unknown date" events — hence one migration rather than two.

Revision ID: d3f7a1b04e59
Revises: e91c3a7d5b28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d3f7a1b04e59"
down_revision: str | Sequence[str] | None = "e91c3a7d5b28"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "events",
        "start_dt",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )


def downgrade() -> None:
    """Re-tighten the column.

    Anything created as a dateless bank template has no date to go back to, so
    the only way to restore NOT NULL is to invent one. `created_at` is the least
    dishonest choice available — it is at least a real moment in that row's
    history — but it is still a fabrication, which is why this direction is
    lossy and worth avoiding.
    """
    op.execute(
        """
        UPDATE events
        SET start_dt = content.created_at
        FROM content
        WHERE events.id = content.id AND events.start_dt IS NULL
        """
    )
    op.alter_column(
        "events",
        "start_dt",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
