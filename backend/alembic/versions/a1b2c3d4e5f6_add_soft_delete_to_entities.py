"""add soft delete to entities

Revision ID: a1b2c3d4e5f6
Revises: 7341ea425998
Create Date: 2026-02-20 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "7341ea425998"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("content", "workspaces", "groups", "troops", "users", "comments", "tags")


def upgrade() -> None:
    """Add deleted_at column to all soft-deletable entity tables."""
    for table in _TABLES:
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Remove deleted_at column from all soft-deletable entity tables."""
    for table in _TABLES:
        op.drop_column(table, "deleted_at")
