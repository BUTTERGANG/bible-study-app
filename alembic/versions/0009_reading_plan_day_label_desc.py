"""Add day_label and description to reading_plan_days.

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-31

Changes:
* `reading_plan_days.day_label` — VARCHAR(50), nullable.
* `reading_plan_days.description` — TEXT, nullable.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    with op.batch_alter_table("reading_plan_days") as batch:
        if not _has_column("reading_plan_days", "day_label"):
            batch.add_column(sa.Column("day_label", sa.String(50), nullable=True))
        if not _has_column("reading_plan_days", "description"):
            batch.add_column(sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("reading_plan_days") as batch:
        batch.drop_column("description")
        batch.drop_column("day_label")
