"""review_comments — internal notes and suggestions to the author

Revision ID: c63a91e7d408
Revises: b52f8c1a94d7
Create Date: 2026-09-07 21:10:00.000000

Reviewers need two different things and they must not be confused: a note kept
between the team, and a suggestion addressed to the person who wrote the item.
`visibility` is a two-value enum rather than a boolean with a default, because a
default would eventually send an internal aside to the person it was about.

Separate from `comments`, which is public discussion between leaders. This table
is Dagskrárstjórnarteymið's own record.

Not soft-deletable: a note that was sent cannot be unsent, and an internal note
is the reasoning behind a decision. Both are the record.

`author_id` is `ON DELETE SET NULL` so removing a person does not erase what
they decided — the note survives them, credited to nobody.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c63a91e7d408"
down_revision: Union[str, Sequence[str], None] = "b52f8c1a94d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VISIBILITY = postgresql.ENUM(
    "internal", "to_author", name="review_comment_visibility_enum", create_type=False
)


def upgrade() -> None:
    # Created explicitly so create_table does not emit a second CREATE TYPE.
    sa.Enum("internal", "to_author", name="review_comment_visibility_enum").create(
        op.get_bind(), checkfirst=True
    )

    op.create_table(
        "review_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("content_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("body", sa.String(length=2000), nullable=False),
        sa.Column("visibility", VISIBILITY, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["content_id"], ["content.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_review_comments_content_id_created_at",
        "review_comments",
        ["content_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_review_comments_content_id_created_at", table_name="review_comments")
    op.drop_table("review_comments")
    sa.Enum(name="review_comment_visibility_enum").drop(op.get_bind(), checkfirst=True)
