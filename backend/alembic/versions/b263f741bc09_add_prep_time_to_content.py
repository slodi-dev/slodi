"""add prep_time to content

Revision ID: b263f741bc09
Revises: eb93eba33650
Create Date: 2026-02-19 19:17:37.079198

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b263f741bc09'
down_revision: Union[str, Sequence[str], None] = 'eb93eba33650'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('content', sa.Column('prep_time', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('content', 'prep_time')
