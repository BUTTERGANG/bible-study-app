"""Add shared_sessions table for study session sharing.

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-08

Stores shareable read-only permalinks to study sessions:
passage reference + note IDs + optional AI conversation ID,
with UUID share_token, expiry, and view count.
"""

import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shared_sessions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("share_token", sa.String(36), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book", sa.String(50), nullable=False),
        sa.Column("chapter", sa.Integer, nullable=False),
        sa.Column("note_ids", sa.Text, server_default="[]"),
        sa.Column("ai_conversation_id", sa.Integer, sa.ForeignKey("ai_conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("translation", sa.String(10), server_default="KJV"),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("view_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.utcnow()),
    )
    op.create_index("ix_shared_sessions_token", "shared_sessions", ["share_token"])
    op.create_index("ix_shared_sessions_user_id", "shared_sessions", ["user_id"])
    op.create_index("ix_shared_sessions_book_chapter", "shared_sessions", ["book", "chapter"])
    op.create_index("ix_shared_sessions_ai_conversation_id", "shared_sessions", ["ai_conversation_id"])


def downgrade() -> None:
    op.drop_index("ix_shared_sessions_ai_conversation_id", table_name="shared_sessions")
    op.drop_index("ix_shared_sessions_book_chapter", table_name="shared_sessions")
    op.drop_index("ix_shared_sessions_user_id", table_name="shared_sessions")
    op.drop_index("ix_shared_sessions_token", table_name="shared_sessions")
    op.drop_table("shared_sessions")
