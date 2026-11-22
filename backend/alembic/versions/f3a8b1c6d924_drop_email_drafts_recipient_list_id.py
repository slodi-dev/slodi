"""drop email_drafts.recipient_list_id

Revision ID: f3a8b1c6d924
Revises: e7b2c4a9d815
Create Date: 2026-11-15 18:00:00.000000

Nothing reads or writes it: there is one list, so a draft goes to the list or to
its manual recipients.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f3a8b1c6d924"
down_revision: Union[str, Sequence[str], None] = "e7b2c4a9d815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("email_drafts", "recipient_list_id")


def downgrade() -> None:
    op.add_column(
        "email_drafts",
        sa.Column("recipient_list_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
