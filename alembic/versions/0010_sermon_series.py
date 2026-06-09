"""Add sermon_series and sermon_series_entries tables.

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-29

Changes:
* `sermon_series` — user_id, title, theme, start_date, end_date
* `sermon_series_entries` — series_id, sermon_id (nullable FK to sermon_projects),
  scheduled_date, status (planned|drafted|preached), notes
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision: str = "0010"
down_revision: str = "0009"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("sermon_series"):
        op.create_table(
            "sermon_series",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
                server_default="0",
            ),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("theme", sa.String(500), nullable=True),
            sa.Column("start_date", sa.String(10), nullable=False),
            sa.Column("end_date", sa.String(10), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    if not _has_table("sermon_series_entries"):
        op.create_table(
            "sermon_series_entries",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "series_id",
                sa.Integer(),
                sa.ForeignKey("sermon_series.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "sermon_id",
                sa.Integer(),
                sa.ForeignKey("sermon_projects.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column("scheduled_date", sa.String(10), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_series_entries_series_id", "sermon_series_entries", ["series_id"])
        op.create_index("ix_series_entries_sermon_id", "sermon_series_entries", ["sermon_id"])


def downgrade() -> None:
    op.drop_table("sermon_series_entries")
    op.drop_table("sermon_series")
