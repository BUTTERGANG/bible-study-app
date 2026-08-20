"""Add reading_streaks, streak_badges, passage_tags, and tag_upvotes tables.

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-08

Tables for reading streak/gamification and community tags features.
"""

import sqlalchemy as sa

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Reading Streaks ───────────────────────────────────────────────────
    op.create_table(
        "reading_streaks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("current_streak", sa.Integer, server_default="0"),
        sa.Column("longest_streak", sa.Integer, server_default="0"),
        sa.Column("last_completed_date", sa.String(10), nullable=True),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.utcnow()),
    )
    op.create_index("ix_streak_user", "reading_streaks", ["user_id"])

    op.create_table(
        "streak_badges",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("milestone", sa.Integer, nullable=False),
        sa.Column("earned_at", sa.DateTime, server_default=sa.func.utcnow()),
    )

    # ── Community Tags ───────────────────────────────────────────────────
    op.create_table(
        "passage_tags",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book", sa.String(50), nullable=True),
        sa.Column("chapter", sa.Integer, nullable=True),
        sa.Column("verse", sa.Integer, nullable=True),
        sa.Column("resource_id", sa.Integer, nullable=True),
        sa.Column("tag_text", sa.String(100), nullable=False),
        sa.Column("upvotes", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.utcnow()),
    )
    op.create_index("ix_passage_tag_ref", "passage_tags", ["book", "chapter"])
    op.create_index("ix_passage_tag_text", "passage_tags", ["tag_text"])
    op.create_index("ix_passage_tag_user", "passage_tags", ["user_id"])
    op.create_index("ix_passage_tag_resource", "passage_tags", ["resource_id"])

    op.create_table(
        "tag_upvotes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_id", sa.Integer, sa.ForeignKey("passage_tags.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.utcnow()),
        sa.UniqueConstraint("user_id", "tag_id", name="uq_tag_upvote"),
    )
    op.create_index("ix_tag_upvote_user", "tag_upvotes", ["user_id"])
    op.create_index("ix_tag_upvote_tag", "tag_upvotes", ["tag_id"])


def downgrade() -> None:
    op.drop_table("tag_upvotes")
    op.drop_table("passage_tags")
    op.drop_table("streak_badges")
    op.drop_table("reading_streaks")
