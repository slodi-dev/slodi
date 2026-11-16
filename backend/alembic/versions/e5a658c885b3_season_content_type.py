"""season content type

Revision ID: e5a658c885b3
Revises: 6476be0e5443
Create Date: 2026-11-17 12:00:00.000000

A starfsár is content at level 3. Until content_type goes, every level needs a type, so
season joins program, event and task. The downgrade deletes season content: the old enum
has nowhere to put it.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "e5a658c885b3"
down_revision: Union[str, Sequence[str], None] = "6476be0e5443"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE content_type_enum ADD VALUE IF NOT EXISTS 'season'")


def downgrade() -> None:
    op.execute("DELETE FROM content WHERE content_type = 'season'")
    op.execute("ALTER TYPE content_type_enum RENAME TO content_type_enum_old")
    op.execute("CREATE TYPE content_type_enum AS ENUM ('program', 'event', 'task')")
    op.execute(
        "ALTER TABLE content ALTER COLUMN content_type TYPE content_type_enum"
        " USING content_type::text::content_type_enum"
    )
    op.execute("DROP TYPE content_type_enum_old")
