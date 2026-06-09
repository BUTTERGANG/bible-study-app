"""Add inline_annotations table for word/phrase-level marginalia.

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-29

Changes:
* `inline_annotations` — user_id, book, chapter, verse, word_start, word_end,
  content, color.  Indexed on (user_id, book, chapter, verse) for per-verse
  lookups.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision: str = "0009"
down_revision: str = "0008"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("inline_annotations"):
        op.create_table(
            "inline_annotations",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
                server_default="0",
            ),
            sa.Column("book", sa.String(50), nullable=False, index=True),
            sa.Column("chapter", sa.Integer(), nullable=False, index=True),
            sa.Column("verse", sa.Integer(), nullable=False, index=True),
            sa.Column("word_start", sa.Integer(), nullable=False),
            sa.Column("word_end", sa.Integer(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("color", sa.String(20), nullable=False, server_default="yellow"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index(
            "ix_inline_annotations_lookup",
            "inline_annotations",
            ["user_id", "book", "chapter", "verse"],
        )


def downgrade() -> None:
    op.drop_index("ix_inline_annotations_lookup", table_name="inline_annotations")
    op.drop_table("inline_annotations")
