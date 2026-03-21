"""add unsubscribe token to emaillist

Revision ID: ef96cf0f8c47
Revises: 47da17d8f7dc
Create Date: 2026-03-21 16:40:58.914486

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "ef96cf0f8c47"
down_revision: Union[str, Sequence[str], None] = "47da17d8f7dc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "emaillist",
        sa.Column("unsubscribe_token", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute("UPDATE emaillist SET unsubscribe_token = gen_random_uuid() WHERE unsubscribe_token IS NULL")
    op.alter_column("emaillist", "unsubscribe_token", nullable=False)
    op.create_unique_constraint(
        "uq_emaillist_unsubscribe_token", "emaillist", ["unsubscribe_token"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_emaillist_unsubscribe_token", "emaillist", type_="unique")
    op.drop_column("emaillist", "unsubscribe_token")
