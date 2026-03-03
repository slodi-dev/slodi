"""move image and media to content, remove task fields

Revision ID: abd31343eed5
Revises: ed5103eb3c65
Create Date: 2026-03-02 20:38:14.900220

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'abd31343eed5'
down_revision: Union[str, Sequence[str], None] = 'ed5103eb3c65'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('ix_comments_content_id_created_at', 'comments', ['content_id', 'created_at'], unique=False)
    op.create_index('ix_comments_user_id_created_at', 'comments', ['user_id', 'created_at'], unique=False)
    op.add_column('content', sa.Column('image', sa.String(length=255), nullable=True))
    op.add_column('content', sa.Column('media', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    # Migrate data: copy image from programs → content
    op.execute("UPDATE content SET image = p.image FROM programs p WHERE p.id = content.id")
    # Migrate data: copy media from tasks → content
    op.execute("UPDATE content SET media = t.media FROM tasks t WHERE t.id = content.id")
    op.drop_column('programs', 'image')
    op.drop_column('tasks', 'participant_min')
    op.drop_column('tasks', 'media')
    op.drop_column('tasks', 'estimated_duration')
    op.drop_column('tasks', 'participant_max')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('tasks', sa.Column('participant_max', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('tasks', sa.Column('estimated_duration', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('tasks', sa.Column('media', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('tasks', sa.Column('participant_min', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('programs', sa.Column('image', sa.VARCHAR(length=255), autoincrement=False, nullable=True))
    # Restore data: copy image from content → programs
    op.execute("UPDATE programs SET image = c.image FROM content c WHERE c.id = programs.id")
    # Restore data: copy media from content → tasks
    op.execute("UPDATE tasks SET media = c.media FROM content c WHERE c.id = tasks.id")
    op.drop_column('content', 'media')
    op.drop_column('content', 'image')
    op.drop_index('ix_comments_user_id_created_at', table_name='comments')
    op.drop_index('ix_comments_content_id_created_at', table_name='comments')
