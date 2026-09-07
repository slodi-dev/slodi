"""posting_suspensions — the skammarkrókur

Revision ID: d74b2f8e1a05
Revises: c63a91e7d408
Create Date: 2026-09-07 22:30:00.000000

A timed pause on someone's ability to submit.

**A table, not columns on `users`, because the history is the point.** "Third
time this year" is exactly what a reviewer needs before deciding, and a boolean
or a single expiry date loses it the moment a second spell begins.

Every suspension is bounded — `expires_at > starts_at` is enforced. An
indefinite one is a ban by another name, and banning an adult volunteer from a
movement is not a decision this screen should be able to make quietly.

`(user_id, expires_at)` is indexed because "is this person suspended right now?"
is asked on every write they attempt.

`issued_by_id` and `lifted_by_id` are `ON DELETE SET NULL`: removing a person
must not erase what was decided, only who decided it.

**Retention is a live question.** These rows are personal data about a named
adult volunteer. The working assumption is that spells older than 24 months stop
counting toward what a reviewer sees while the rows are kept for audit — that
needs confirming with whoever owns persónuvernd before launch. Nothing here
enforces it yet.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d74b2f8e1a05"
down_revision: Union[str, Sequence[str], None] = "c63a91e7d408"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "posting_suspensions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("issued_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("lifted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lifted_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("lift_reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["issued_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lifted_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("expires_at > starts_at", name="ck_posting_suspensions_ends_after_start"),
    )
    op.create_index(
        "ix_posting_suspensions_user_id_expires_at",
        "posting_suspensions",
        ["user_id", "expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_posting_suspensions_user_id_expires_at", table_name="posting_suspensions")
    op.drop_table("posting_suspensions")
