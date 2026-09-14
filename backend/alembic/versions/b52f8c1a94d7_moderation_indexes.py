"""indexes the review board needs at ten thousand rows

Revision ID: b52f8c1a94d7
Revises: a91d4e7c3b52
Create Date: 2026-09-07 20:05:00.000000

Measured against a Postgres 16 container holding 10,000 bank items, 60 authors
and ~780 open reports.

The board's page of 50 took **46 ms**, and almost all of it was one thing: the
derived strike count. It asks, per row, "how much of this author's work has been
hidden or rejected?" — and the existing `(author_id, review_state)` index cannot
serve the `hidden_at IS NOT NULL OR review_state = 'rejected'` predicate, so
each row scanned every row that author had ever written.

A partial index on exactly that predicate takes the same page to **6 ms**. It is
small, because it only indexes content somebody acted against — a few percent of
the table rather than all of it.

The other two per-row subqueries (report count, report reasons) are already
served by `ix_content_reports_content_id`.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "b52f8c1a94d7"
down_revision: Union[str, Sequence[str], None] = "a91d4e7c3b52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_content_author_strikes
        ON content (author_id)
        WHERE deleted_at IS NULL
          AND (hidden_at IS NOT NULL OR review_state = 'rejected')
        """
    )


def downgrade() -> None:
    op.drop_index("ix_content_author_strikes", table_name="content")
