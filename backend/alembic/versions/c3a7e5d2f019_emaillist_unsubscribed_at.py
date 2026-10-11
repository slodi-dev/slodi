"""emaillist: keep unsubscribed rows (unsubscribed_at)

Unsubscribing used to delete the row, so reusing the link — a second click,
or a mail provider retrying its RFC 8058 one-click POST — found no token and
got 404. Rows are now kept and marked; every send reads only rows where
unsubscribed_at is null.

Revision ID: c3a7e5d2f019
Revises: 505edb93669c
Create Date: 2026-10-11 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3a7e5d2f019"
down_revision: Union[str, Sequence[str], None] = "505edb93669c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "emaillist",
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    # Restore the old meaning: an unsubscribed address is not on the list.
    op.execute("DELETE FROM emaillist WHERE unsubscribed_at IS NOT NULL")
    op.drop_column("emaillist", "unsubscribed_at")
