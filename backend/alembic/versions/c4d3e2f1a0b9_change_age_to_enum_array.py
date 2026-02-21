"""change_age_to_enum_array

Revision ID: c4d3e2f1a0b9
Revises: 7341ea425998
Create Date: 2026-02-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c4d3e2f1a0b9"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

age_group_enum = postgresql.ENUM(
    "Hrefnuskátar",
    "Drekaskátar",
    "Fálkaskátar",
    "Dróttskátar",
    "Rekkaskátar",
    "Róverskátar",
    "Vættaskátar",
    name="age_group_enum",
)


def upgrade() -> None:
    """Upgrade schema."""
    age_group_enum.create(op.get_bind(), checkfirst=True)
    op.drop_column("content", "age")
    op.add_column(
        "content",
        sa.Column(
            "age",
            postgresql.ARRAY(age_group_enum),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("content", "age")
    op.add_column(
        "content",
        sa.Column("age", sa.VARCHAR(length=50), nullable=True),
    )
    age_group_enum.drop(op.get_bind(), checkfirst=True)
