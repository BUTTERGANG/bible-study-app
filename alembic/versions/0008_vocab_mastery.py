"""Add vocab_mastery table for per-user vocabulary drill progress.

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-29

Changes:
* `vocab_mastery` — user_id, strongs_num, language, mastery_level (0-3),
  attempts, correct_count, last_reviewed, added_at.
  Unique on (user_id, strongs_num, language).
"""

import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

from alembic import op

revision: str = "0015"
down_revision: str = "0014"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("vocab_mastery"):
        op.create_table(
            "vocab_mastery",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
                server_default="0",
            ),
            sa.Column("strongs_num", sa.String(10), nullable=False, index=True),
            sa.Column("language", sa.String(10), nullable=False),
            sa.Column("mastery_level", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_reviewed", sa.DateTime(), nullable=True),
            sa.Column("added_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("user_id", "strongs_num", "language", name="uq_vocab_mastery"),
        )
        op.create_index("ix_vocab_mastery_user_id", "vocab_mastery", ["user_id"])


def downgrade() -> None:
    op.drop_table("vocab_mastery")
