"""tag name unique among live tags

Revision ID: 8d15668ed4d4
Revises: 505edb93669c
Create Date: 2026-10-10 23:46:53.939427

Tags are soft-deleted, but `uq_tag_name` covered every row, so once a tag was
deleted its name could never be used again (sc-540). The constraint becomes a
partial unique index over live tags only.

Deleting a tag now also removes it from every item. The upgrade does the same
for tags deleted before this change, whose links were left behind and kept the
tag showing on items, in facets and in filters. Those links are not restored on
downgrade: they pointed at deleted tags, which nothing should show.

Downgrade puts the full constraint back. Once a name has been reused there are
two rows with it, so each deleted duplicate is renamed first with a short id
suffix; live tags keep their names.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "8d15668ed4d4"
down_revision: Union[str, Sequence[str], None] = "505edb93669c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DELETE FROM content_tags "
        "WHERE tag_id IN (SELECT id FROM tags WHERE deleted_at IS NOT NULL)"
    )
    op.drop_constraint("uq_tag_name", "tags", type_="unique")
    op.create_index(
        "uq_tag_name_active",
        "tags",
        ["name"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_tag_name_active", table_name="tags", postgresql_where=sa.text("deleted_at IS NULL")
    )
    # Names are at most 50 characters: 41 + " ~" + 7 characters of the id.
    op.execute(
        """
        UPDATE tags AS t
        SET name = left(t.name, 41) || ' ~' || left(t.id::text, 7)
        WHERE t.deleted_at IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM tags AS o
            WHERE o.name = t.name
              AND o.id <> t.id
              AND (o.deleted_at IS NULL OR o.id < t.id)
          )
        """
    )
    op.create_unique_constraint("uq_tag_name", "tags", ["name"])
