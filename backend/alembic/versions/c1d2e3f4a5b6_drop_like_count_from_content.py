"""drop like_count from content

Revision ID: c1d2e3f4a5b6
Revises: a1b2c3d4e5f6
Create Date: 2026-02-21 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_content_like_nonneg", "content", type_="check")
    op.drop_column("content", "like_count")


def downgrade() -> None:
    op.add_column(
        "content",
        sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint("ck_content_like_nonneg", "content", "like_count >= 0")
