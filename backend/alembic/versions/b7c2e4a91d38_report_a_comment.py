"""Let a report point at a comment, not only at an item

Comments are the bank's only public text surface, and until now they could not
be flagged: `content_reports` keyed on `content_id` alone.

`content_id` stays populated for a comment report — a comment always hangs
under an item, and the review board needs to name that item without a second
join.

The single unique constraint is replaced by two partial indexes. A plain
`UNIQUE(content_id, comment_id, reporter_id)` would not do: in Postgres NULL is
distinct from NULL, so the moment `comment_id` is nullable that constraint stops
deduplicating item reports, and one determined account could stack a queue
against an item again.

Revision ID: b7c2e4a91d38
Revises: d3f7a1b04e59
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7c2e4a91d38"
down_revision: str | None = "d3f7a1b04e59"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "content_reports",
        sa.Column("comment_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_content_reports_comment_id",
        "content_reports",
        "comments",
        ["comment_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "uq_content_reports_content_reporter", "content_reports", type_="unique"
    )

    op.create_index(
        "uq_content_reports_item_reporter",
        "content_reports",
        ["content_id", "reporter_id"],
        unique=True,
        postgresql_where=sa.text("comment_id IS NULL"),
    )
    op.create_index(
        "uq_content_reports_comment_reporter",
        "content_reports",
        ["comment_id", "reporter_id"],
        unique=True,
        postgresql_where=sa.text("comment_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_content_reports_comment_reporter", table_name="content_reports")
    op.drop_index("uq_content_reports_item_reporter", table_name="content_reports")

    # Comment reports would collide with the item-level constraint being
    # restored, so they go with it.
    op.execute("DELETE FROM content_reports WHERE comment_id IS NOT NULL")

    op.create_unique_constraint(
        "uq_content_reports_content_reporter",
        "content_reports",
        ["content_id", "reporter_id"],
    )
    op.drop_constraint("fk_content_reports_comment_id", "content_reports", type_="foreignkey")
    op.drop_column("content_reports", "comment_id")
