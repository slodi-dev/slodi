"""add heidursordla tables and seed Saturday rounds 1 and 2

Revision ID: f1e2d3c4b5a6
Revises: b2c3d4e5f6a7
Create Date: 2026-04-10 18:30:00.000000

Creates the two tables that power Heiðursorðla — Slóði's Saturday-only
Skátaþing 2026 word-guessing event:

- ``heidursordla_puzzles`` — schedule rows, one per round, seeded ahead of
  time with explicit ``(unlocks_at, locks_at)`` windows.
- ``heidursordla_attempts`` — one row per (user, puzzle) pair tracking the
  player's guesses, current status, and finish time.

The migration also seeds the first two locked answers:

- Round 1: ``hnýta`` (08:00–11:00 Atlantic/Reykjavik)
- Round 2: ``æskan`` (11:00–14:00 Atlantic/Reykjavik)

Rounds 3 and 4 are deliberately not seeded — the curator inserts them as
SQL during Saturday morning before each round opens. The seed inserts use
``ON CONFLICT DO NOTHING`` against the puzzle_number unique constraint so
re-running the migration in any state is safe.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create heidursordla_puzzles + heidursordla_attempts tables, seed R1+R2."""
    # ── heidursordla_puzzles ───────────────────────────────────────────────
    op.create_table(
        "heidursordla_puzzles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("puzzle_number", sa.Integer(), nullable=False),
        sa.Column("answer", sa.String(8), nullable=False),
        sa.Column(
            "word_length",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("5"),
        ),
        sa.Column(
            "unlocks_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "locks_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "puzzle_number", name="uq_heidursordla_puzzles_puzzle_number"
        ),
        sa.CheckConstraint(
            "char_length(answer) = 5",
            name="ck_heidursordla_puzzles_answer_length",
        ),
        sa.CheckConstraint(
            "locks_at > unlocks_at",
            name="ck_heidursordla_puzzles_window_ordered",
        ),
    )

    # ── heidursordla_attempts ──────────────────────────────────────────────
    # Postgres enum for status. We let SAEnum create it.
    attempt_status_enum = postgresql.ENUM(
        "in_progress",
        "won",
        "lost",
        name="heidursordla_attempt_status_enum",
        create_type=True,
    )
    attempt_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "heidursordla_attempts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "puzzle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("heidursordla_puzzles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "guesses",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "in_progress",
                "won",
                "lost",
                name="heidursordla_attempt_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'in_progress'::heidursordla_attempt_status_enum"),
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "user_id", "puzzle_id", name="uq_heidursordla_attempts_user_puzzle"
        ),
        sa.CheckConstraint(
            "jsonb_array_length(guesses) <= 6",
            name="ck_heidursordla_attempts_guess_cap",
        ),
    )
    op.create_index(
        "ix_heidursordla_attempts_puzzle_status_finished",
        "heidursordla_attempts",
        ["puzzle_id", "status", "finished_at"],
    )

    # ── Seed Round 1 (hnýta) and Round 2 (æskan) ───────────────────────────
    # Iceland is on UTC year-round (no DST), so 08:00 Atlantic/Reykjavik is
    # 08:00 UTC. We persist as UTC timestamptz throughout.
    op.execute(
        sa.text(
            """
            INSERT INTO heidursordla_puzzles
                (puzzle_number, answer, word_length, unlocks_at, locks_at, created_at)
            VALUES
                (1, 'hnýta', 5,
                 TIMESTAMPTZ '2026-04-11 08:00:00+00:00',
                 TIMESTAMPTZ '2026-04-11 11:00:00+00:00',
                 NOW()),
                (2, 'æskan', 5,
                 TIMESTAMPTZ '2026-04-11 11:00:00+00:00',
                 TIMESTAMPTZ '2026-04-11 14:00:00+00:00',
                 NOW())
            ON CONFLICT (puzzle_number) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    """Drop heidursordla tables and the attempt-status enum."""
    op.drop_index(
        "ix_heidursordla_attempts_puzzle_status_finished",
        table_name="heidursordla_attempts",
    )
    op.drop_table("heidursordla_attempts")
    op.drop_table("heidursordla_puzzles")
    sa.Enum(name="heidursordla_attempt_status_enum").drop(op.get_bind(), checkfirst=True)
