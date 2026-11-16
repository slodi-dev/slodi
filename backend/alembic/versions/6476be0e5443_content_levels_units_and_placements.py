"""content levels, units and placements

Revision ID: 6476be0e5443
Revises: f3a8b1c6d924
Create Date: 2026-11-16 12:00:00.000000

Step A of docs/features/data-model.html: the new structure next to the old one. Content
gets a level (from its type) and copied_from_id; units, placements and unit_participation
are new. Nothing is removed yet. Production has only tasks and no troops, so nothing else
carries over.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "6476be0e5443"
down_revision: Union[str, Sequence[str], None] = "f3a8b1c6d924"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("content", sa.Column("level", sa.SmallInteger(), nullable=True))
    op.execute(
        """
        UPDATE content SET level = CASE content_type
            WHEN 'task' THEN 0
            WHEN 'event' THEN 1
            WHEN 'program' THEN 2
        END
        """
    )
    op.alter_column("content", "level", nullable=False)
    op.create_check_constraint("ck_content_level_nonneg", "content", "level >= 0")
    op.create_unique_constraint(
        "uq_content_id_level_workspace", "content", ["id", "level", "workspace_id"]
    )

    op.add_column(
        "content", sa.Column("copied_from_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_content_copied_from_id_content",
        "content",
        "content",
        ["copied_from_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_content_copied_from_id", "content", ["copied_from_id"])

    op.create_table(
        "units",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("id", "workspace_id", name="uq_units_id_workspace"),
        sa.ForeignKeyConstraint(
            ["parent_id", "workspace_id"],
            ["units.id", "units.workspace_id"],
            ondelete="CASCADE",
            name="fk_units_parent",
        ),
        sa.CheckConstraint("color ~ '^#[0-9a-f]{6}$'", name="ck_units_color_hex"),
    )
    op.create_index("ix_units_workspace_id", "units", ["workspace_id"])
    op.create_index("ix_units_parent_id", "units", ["parent_id"])

    op.create_table(
        "placements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_level", sa.SmallInteger(), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("parent_level", sa.SmallInteger(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("time_set", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "id", "content_level", "workspace_id", name="uq_placements_id_level_workspace"
        ),
        sa.ForeignKeyConstraint(
            ["content_id", "content_level", "workspace_id"],
            ["content.id", "content.level", "content.workspace_id"],
            onupdate="CASCADE",
            ondelete="CASCADE",
            name="fk_placements_content",
        ),
        sa.ForeignKeyConstraint(
            ["parent_id", "parent_level", "workspace_id"],
            ["placements.id", "placements.content_level", "placements.workspace_id"],
            onupdate="CASCADE",
            ondelete="CASCADE",
            name="fk_placements_parent",
        ),
        sa.CheckConstraint(
            "(parent_id IS NULL) = (parent_level IS NULL)", name="ck_placements_parent_has_level"
        ),
        sa.CheckConstraint(
            "parent_level IS NULL OR content_level < parent_level",
            name="ck_placements_level_below_parent",
        ),
        sa.CheckConstraint("ends_at >= starts_at", name="ck_placements_ends_after_start"),
    )
    op.create_index("ix_placements_parent_id", "placements", ["parent_id"])
    op.create_index("ix_placements_content_id", "placements", ["content_id"])
    op.create_index(
        "ix_placements_workspace_id_starts_at", "placements", ["workspace_id", "starts_at"]
    )

    op.create_table(
        "unit_participation",
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("placement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("unit_id", "placement_id"),
        sa.ForeignKeyConstraint(["unit_id"], ["units.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["placement_id"], ["placements.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_unit_participation_placement_id", "unit_participation", ["placement_id"])


def downgrade() -> None:
    op.drop_table("unit_participation")
    op.drop_table("placements")
    op.drop_table("units")
    op.drop_index("ix_content_copied_from_id", table_name="content")
    op.drop_constraint("fk_content_copied_from_id_content", "content", type_="foreignkey")
    op.drop_column("content", "copied_from_id")
    op.drop_constraint("uq_content_id_level_workspace", "content", type_="unique")
    op.drop_constraint("ck_content_level_nonneg", "content", type_="check")
    op.drop_column("content", "level")
