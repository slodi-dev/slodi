"""content_reports — flagging something that does not belong

Revision ID: f4c8d1e2b906
Revises: ab250ef64e42
Create Date: 2026-09-07 16:55:00.000000

Once anyone with an account can submit to the bank, anyone with an account needs
to be able to flag. One row per person per item.

The unique constraint on `(content_id, reporter_id)` is what keeps the number a
reviewer reads meaningful: without it a single account can stack a queue against
an item it dislikes, and "how many people flagged this" quietly becomes "how
determined was one person".

`unsafe` is a separate reason from `inappropriate` because the two get different
response times — the first is a safeguarding matter escalated by email within
the day, the second is a quality judgement that waits for the next sweep.

Not soft-deletable: a resolved report is closed, not removed. The record is what
lets a reviewer see that an item has been flagged before, and — once the review
board lands — how often a given author's work has been.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f4c8d1e2b906"
down_revision: Union[str, Sequence[str], None] = "ab250ef64e42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REASON = postgresql.ENUM(
    "inappropriate", "unsafe", "spam", "duplicate", "wrong_type", "other",
    name="report_reason_enum", create_type=False,
)
STATUS = postgresql.ENUM(
    "open", "resolved", "dismissed", name="report_status_enum", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    # Created explicitly so create_table does not emit a second CREATE TYPE.
    sa.Enum(
        "inappropriate", "unsafe", "spam", "duplicate", "wrong_type", "other",
        name="report_reason_enum",
    ).create(bind, checkfirst=True)
    sa.Enum("open", "resolved", "dismissed", name="report_status_enum").create(
        bind, checkfirst=True
    )

    op.create_table(
        "content_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("content_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", REASON, nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("status", STATUS, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["content_id"], ["content.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "content_id", "reporter_id", name="uq_content_reports_content_reporter"
        ),
        sa.CheckConstraint(
            "status = 'open' OR resolved_at IS NOT NULL",
            name="ck_content_reports_closed_has_timestamp",
        ),
    )
    # The review board's query: open reports, newest first.
    op.create_index(
        "ix_content_reports_status_created_at", "content_reports", ["status", "created_at"]
    )
    # Counting an author's reports means joining through content.
    op.create_index("ix_content_reports_content_id", "content_reports", ["content_id"])


def downgrade() -> None:
    op.drop_index("ix_content_reports_content_id", table_name="content_reports")
    op.drop_index("ix_content_reports_status_created_at", table_name="content_reports")
    op.drop_table("content_reports")
    bind = op.get_bind()
    sa.Enum(name="report_status_enum").drop(bind, checkfirst=True)
    sa.Enum(name="report_reason_enum").drop(bind, checkfirst=True)
