"""Add counseling_guides table for AI-generated pastoral guides.

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-29

Changes:
* `counseling_guides` — name (unique), category, content (JSON), generated_at, updated_at.
"""

from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _has_table("counseling_guides"):
        return
    op.create_table(
        "counseling_guides",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(200), nullable=False, index=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("name", name="uq_counseling_name"),
    )
    op.create_index("ix_counseling_name", "counseling_guides", ["name"])
    op.create_index("ix_counseling_category", "counseling_guides", ["category"])


def downgrade() -> None:
    op.drop_index("ix_counseling_category", table_name="counseling_guides")
    op.drop_index("ix_counseling_name", table_name="counseling_guides")
    op.drop_table("counseling_guides")
