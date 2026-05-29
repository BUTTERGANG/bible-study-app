"""Add doctrine_entries table for doctrinal topic index.

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-29

Changes:
* `doctrine_entries` — name, category, content (JSON), generated_at, updated_at.
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "doctrine_entries",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(200), nullable=False, index=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("name", name="uq_doctrine_name"),
    )
    op.create_index("ix_doctrine_name", "doctrine_entries", ["name"])
    op.create_index("ix_doctrine_category", "doctrine_entries", ["category"])


def downgrade() -> None:
    op.drop_index("ix_doctrine_category", table_name="doctrine_entries")
    op.drop_index("ix_doctrine_name", table_name="doctrine_entries")
    op.drop_table("doctrine_entries")
