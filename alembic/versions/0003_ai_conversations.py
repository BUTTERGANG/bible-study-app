"""Add ai_conversations table for persisted AI chat history.

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-22

Changes:
* New `ai_conversations` table (user_id, reference, translation, book,
  chapter, messages, message_count, title, created_at, updated_at).
* Unique constraint per (user_id, reference) so each book/chapter pair
  has at most one conversation record.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    if _has_table("ai_conversations"):
        return

    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, server_default="0", index=True),
        sa.Column("reference", sa.String(100), nullable=False, index=True),
        sa.Column("translation", sa.String(10), nullable=False, server_default="KJV"),
        sa.Column("book", sa.String(50), nullable=False),
        sa.Column("chapter", sa.Integer, nullable=False),
        sa.Column("messages", sa.Text, nullable=False, server_default="[]"),
        sa.Column("message_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    with op.batch_alter_table("ai_conversations") as batch:
        batch.create_unique_constraint("uq_ai_conv_ref", ["user_id", "reference"])


def downgrade() -> None:
    if _has_table("ai_conversations"):
        with op.batch_alter_table("ai_conversations") as batch:
            batch.drop_constraint("uq_ai_conv_ref", type_="unique")
        op.drop_table("ai_conversations")