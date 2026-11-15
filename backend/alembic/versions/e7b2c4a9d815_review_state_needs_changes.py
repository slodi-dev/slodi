"""review state needs_changes; hidden follows review state

Revision ID: e7b2c4a9d815
Revises: d5c13784359f
Create Date: 2026-11-15 12:00:00.000000

Every item that is hidden or rejected becomes `needs_changes`, so its author can
fix it. Strikes now count only `rejected`, so the partial strike index goes.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "e7b2c4a9d815"
down_revision: Union[str, Sequence[str], None] = "d5c13784359f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Its own transaction: a value added here cannot be used in the same one.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE review_state_enum ADD VALUE IF NOT EXISTS 'needs_changes'")

    op.execute(
        """
        UPDATE content
        SET review_state = 'needs_changes',
            hidden_at = COALESCE(hidden_at, reviewed_at, now())
        WHERE hidden_at IS NOT NULL OR review_state = 'rejected'
        """
    )
    op.drop_index("ix_content_author_strikes", table_name="content")


def downgrade() -> None:
    op.execute("UPDATE content SET review_state = 'rejected' WHERE review_state = 'needs_changes'")
    # Postgres cannot drop an enum value, so the type is rebuilt without it.
    op.drop_index("ix_content_review_state_created_at", table_name="content")
    op.drop_index("ix_content_author_id_review_state", table_name="content")
    op.execute("ALTER TYPE review_state_enum RENAME TO review_state_enum_old")
    op.execute("CREATE TYPE review_state_enum AS ENUM ('unreviewed', 'approved', 'rejected')")
    op.execute(
        "ALTER TABLE content ALTER COLUMN review_state TYPE review_state_enum "
        "USING review_state::text::review_state_enum"
    )
    op.execute("DROP TYPE review_state_enum_old")
    op.create_index("ix_content_review_state_created_at", "content", ["review_state", "created_at"])
    op.create_index("ix_content_author_id_review_state", "content", ["author_id", "review_state"])
    op.execute(
        """
        CREATE INDEX ix_content_author_strikes
        ON content (author_id)
        WHERE deleted_at IS NULL AND (hidden_at IS NOT NULL OR review_state = 'rejected')
        """
    )
