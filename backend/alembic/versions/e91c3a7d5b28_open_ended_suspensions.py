"""suspensions may be open-ended

Revision ID: e91c3a7d5b28
Revises: d74b2f8e1a05
Create Date: 2026-09-07 23:40:00.000000

`expires_at` becomes nullable, and null means the suspension runs until somebody
lifts it.

The original design bounded every suspension deliberately — an open-ended one is
a heavy thing to do to an adult volunteer. Dagskrárstjórnarteymið asked for it,
and it is theirs to own: every suspension is recorded, attributed and reversible
by the same people, which is what makes it safe to offer rather than escalate.

The check constraint is relaxed rather than dropped: a dated suspension must
still end after it starts.

Every read of "is this person suspended?" now has to treat a null expiry as
open-ended rather than as expired — see `active_at` on the model and
`active_for` in the repository.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e91c3a7d5b28"
down_revision: Union[str, Sequence[str], None] = "d74b2f8e1a05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "posting_suspensions",
        "expires_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.drop_constraint(
        "ck_posting_suspensions_ends_after_start", "posting_suspensions", type_="check"
    )
    op.create_check_constraint(
        "ck_posting_suspensions_ends_after_start",
        "posting_suspensions",
        "expires_at IS NULL OR expires_at > starts_at",
    )


def downgrade() -> None:
    # An open-ended suspension has no end to restore, and inventing one would
    # silently release people or silently extend them. Lift them first.
    op.execute("DELETE FROM posting_suspensions WHERE expires_at IS NULL")
    op.drop_constraint(
        "ck_posting_suspensions_ends_after_start", "posting_suspensions", type_="check"
    )
    op.create_check_constraint(
        "ck_posting_suspensions_ends_after_start",
        "posting_suspensions",
        "expires_at > starts_at",
    )
    op.alter_column(
        "posting_suspensions",
        "expires_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
