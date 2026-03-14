"""add FK constraint to events.program_id

Revision ID: aeaa97f45732
Revises: c3d4e5f6a7b8
Create Date: 2026-03-02 22:10:43.065624

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aeaa97f45732'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_foreign_key('fk_events_program_id_programs', 'events', 'programs', ['program_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_events_program_id_programs', 'events', type_='foreignkey')
