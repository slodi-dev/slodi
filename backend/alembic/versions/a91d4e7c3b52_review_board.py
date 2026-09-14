"""review board — moderator permission, review state and hiding

Revision ID: a91d4e7c3b52
Revises: f4c8d1e2b906
Create Date: 2026-09-07 18:10:00.000000

What Dagskrárstjórnarteymið needs to sweep the bank.

**`moderator` is added to `permissions_enum` in an autocommit block.** Postgres
will not let a value added by `ALTER TYPE ... ADD VALUE` be *used* later in the
same transaction, and Alembic wraps a migration in one by default. Adding it in
its own block keeps the rest of this migration transactional.

**`review_state` and `hidden_at` are deliberately two things.** The bank
publishes on submit and reviews afterwards, so an `unreviewed` item is already
live and a `rejected` one is not automatically hidden. Fusing them would make
approval the only route to visibility, which turns a 3-person queue into a
bottleneck on every submission.

`hidden_at` mirrors `deleted_at` on purpose — it means the same thing, "not
listed, not gone", and reusing the shape means the listing filters read the same
way.

Existing content is backfilled to `unreviewed`, not `approved`. It has genuinely
never been reviewed, and marking it approved would empty the board on day one
and hide exactly the backlog the team is being asked to work through.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a91d4e7c3b52"
down_revision: Union[str, Sequence[str], None] = "f4c8d1e2b906"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REVIEW_STATE = postgresql.ENUM(
    "unreviewed", "approved", "rejected", name="review_state_enum", create_type=False
)


def upgrade() -> None:
    # Its own transaction: a value added here cannot be used in the same one.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE permissions_enum ADD VALUE IF NOT EXISTS 'moderator'")

    sa.Enum("unreviewed", "approved", "rejected", name="review_state_enum").create(
        op.get_bind(), checkfirst=True
    )

    op.add_column("content", sa.Column("review_state", REVIEW_STATE, nullable=True))
    op.add_column(
        "content", sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column("content", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("content", sa.Column("review_note", sa.String(length=500), nullable=True))
    op.add_column("content", sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_content_reviewed_by_id", "content", "users", ["reviewed_by_id"], ["id"],
        ondelete="SET NULL",
    )

    # Never reviewed is the truth about every existing row.
    op.execute("UPDATE content SET review_state = 'unreviewed'")
    op.alter_column("content", "review_state", nullable=False)

    # The board's query: the unreviewed queue, oldest first.
    op.create_index(
        "ix_content_review_state_created_at", "content", ["review_state", "created_at"]
    )
    # Every bank listing filters hidden rows out, the same way it filters deleted.
    op.create_index("ix_content_hidden_at", "content", ["hidden_at"])
    # Counting an author's strikes reads these two together.
    op.create_index("ix_content_author_id_review_state", "content", ["author_id", "review_state"])


def downgrade() -> None:
    op.drop_index("ix_content_author_id_review_state", table_name="content")
    op.drop_index("ix_content_hidden_at", table_name="content")
    op.drop_index("ix_content_review_state_created_at", table_name="content")
    op.drop_constraint("fk_content_reviewed_by_id", "content", type_="foreignkey")
    for column in ("hidden_at", "review_note", "reviewed_at", "reviewed_by_id", "review_state"):
        op.drop_column("content", column)
    sa.Enum(name="review_state_enum").drop(op.get_bind(), checkfirst=True)
    # `moderator` is deliberately left on permissions_enum. Postgres cannot drop
    # a single enum label, and recreating the type would need every dependent
    # column rewritten — a far more destructive downgrade than the upgrade was.
    # A stray unused label is harmless; anyone holding it should be demoted first.
