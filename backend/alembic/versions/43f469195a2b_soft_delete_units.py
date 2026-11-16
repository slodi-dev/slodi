"""soft delete units

Revision ID: 43f469195a2b
Revises: e5a658c885b3
Create Date: 2026-11-17 15:00:00.000000

A deleted unit stays on the placements it was for, so past plans keep saying who they were for.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "43f469195a2b"
down_revision: Union[str, Sequence[str], None] = "e5a658c885b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("units", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("units", "deleted_at")
