"""add position to events and tasks

Revision ID: 07dd9bcf0ea4
Revises: 47da17d8f7dc
Create Date: 2026-03-15 16:29:07.083754

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07dd9bcf0ea4'
down_revision: Union[str, Sequence[str], None] = '47da17d8f7dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('events', sa.Column('position', sa.Integer(), server_default='0', nullable=False))
    op.add_column('tasks', sa.Column('position', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tasks', 'position')
    op.drop_column('events', 'position')
