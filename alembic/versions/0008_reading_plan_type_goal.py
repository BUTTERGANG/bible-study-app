"""Add plan_type and goal columns to reading_plans.

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-31

Changes:
* `reading_plans.plan_type` — VARCHAR(20), default 'built-in', indexed.
* `reading_plans.goal` — TEXT, nullable.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    with op.batch_alter_table("reading_plans") as batch:
        if not _has_column("reading_plans", "plan_type"):
            batch.add_column(
                sa.Column("plan_type", sa.String(20), nullable=False, server_default="built-in")
            )
        if not _has_column("reading_plans", "goal"):
            batch.add_column(sa.Column("goal", sa.Text(), nullable=True))

    if not _has_column("reading_plans", "plan_type"):
        op.create_index("ix_reading_plans_plan_type", "reading_plans", ["plan_type"])


def downgrade() -> None:
    with op.batch_alter_table("reading_plans") as batch:
        batch.drop_column("goal")
        batch.drop_column("plan_type")
