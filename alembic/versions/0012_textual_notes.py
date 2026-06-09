"""Add textual_notes table for AI-generated passage summaries.

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-29

Changes:
* `textual_notes` — passage_key (unique), content (JSON), generated_at.
"""

from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _has_table("textual_notes"):
        return
    op.create_table(
        "textual_notes",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("passage_key", sa.String(80), nullable=False, unique=True, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_textual_notes_passage_key", "textual_notes", ["passage_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_textual_notes_passage_key", table_name="textual_notes")
    op.drop_table("textual_notes")
