"""fix heidursordla round windows to 10:30 cadence

Revision ID: a7b8c9d0e1f2
Revises: f1e2d3c4b5a6
Create Date: 2026-04-11 08:00:00.000000

The original seed migration (``f1e2d3c4b5a6``) used an 08:00/11:00/14:00
round cadence. Programme committee moved the Heiðursorðla drops to a
10:30/13:00/15:30/18:00 cadence the night before the event. This is a
fix-up revision that:

1. UPDATEs any already-seeded R1/R2 rows to the new window.
2. INSERTs R1/R2 with ON CONFLICT DO UPDATE so a database that somehow
   missed the original seed still ends up with the correct values.

Iceland is UTC year-round (no DST), so wall-clock Atlantic/Reykjavik is
the same as UTC — no TZ arithmetic needed.

The downgrade reverts to the original 08:00/11:00/14:00 windows to keep
alembic history reversible.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Re-point R1/R2 to the 10:30 → 13:00 → 15:30 cadence."""
    # Update any existing seeded rows.
    op.execute(
        """
        UPDATE heidursordla_puzzles
        SET unlocks_at = TIMESTAMPTZ '2026-04-11 10:30:00+00:00',
            locks_at   = TIMESTAMPTZ '2026-04-11 13:00:00+00:00'
        WHERE puzzle_number = 1
        """
    )
    op.execute(
        """
        UPDATE heidursordla_puzzles
        SET unlocks_at = TIMESTAMPTZ '2026-04-11 13:00:00+00:00',
            locks_at   = TIMESTAMPTZ '2026-04-11 15:30:00+00:00'
        WHERE puzzle_number = 2
        """
    )

    # Upsert in case the original insert never ran (fresh DB with a bad
    # state, or a seed that got rolled back partway). This makes the
    # revision idempotent under every starting state we care about.
    op.execute(
        """
        INSERT INTO heidursordla_puzzles
            (puzzle_number, answer, word_length, unlocks_at, locks_at, created_at)
        VALUES
            (1, 'hnýta', 5,
             TIMESTAMPTZ '2026-04-11 10:30:00+00:00',
             TIMESTAMPTZ '2026-04-11 13:00:00+00:00',
             NOW()),
            (2, 'æskan', 5,
             TIMESTAMPTZ '2026-04-11 13:00:00+00:00',
             TIMESTAMPTZ '2026-04-11 15:30:00+00:00',
             NOW())
        ON CONFLICT (puzzle_number) DO UPDATE
            SET unlocks_at = EXCLUDED.unlocks_at,
                locks_at   = EXCLUDED.locks_at
        """
    )


def downgrade() -> None:
    """Revert R1/R2 windows to the original 08:00/11:00/14:00 cadence."""
    op.execute(
        """
        UPDATE heidursordla_puzzles
        SET unlocks_at = TIMESTAMPTZ '2026-04-11 08:00:00+00:00',
            locks_at   = TIMESTAMPTZ '2026-04-11 11:00:00+00:00'
        WHERE puzzle_number = 1
        """
    )
    op.execute(
        """
        UPDATE heidursordla_puzzles
        SET unlocks_at = TIMESTAMPTZ '2026-04-11 11:00:00+00:00',
            locks_at   = TIMESTAMPTZ '2026-04-11 14:00:00+00:00'
        WHERE puzzle_number = 2
        """
    )
