"""Add clause syntax table.

Revision ID: 0015_clause_syntax
Revises: 0014_language_courses
Create Date: 2026-06-08
"""

from alembic import op
import sqlalchemy as sa

revision = "0015_clause_syntax"
down_revision = "0014_language_courses"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _has_table("clause_syntax"):
        return
    op.create_table(
        "clause_syntax",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="fixture", index=True),
        sa.Column("book", sa.String(50), nullable=False, index=True),
        sa.Column("book_num", sa.Integer(), nullable=False, index=True),
        sa.Column("chapter", sa.Integer(), nullable=False, index=True),
        sa.Column("verse_start", sa.Integer(), nullable=False),
        sa.Column("verse_end", sa.Integer(), nullable=False),
        sa.Column("clause_id", sa.String(100), nullable=False, index=True),
        sa.Column("clause_text", sa.Text(), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, index=True),
        sa.Column("verb_tense", sa.String(30), nullable=True, index=True),
        sa.Column("verb_voice", sa.String(30), nullable=True, index=True),
        sa.Column("verb_mood", sa.String(30), nullable=True, index=True),
        sa.Column("verb_person", sa.String(10), nullable=True),
        sa.Column("verb_number", sa.String(10), nullable=True),
        sa.Column("verb_lemma", sa.String(100), nullable=True, index=True),
        sa.Column("verb_strongs", sa.String(20), nullable=True, index=True),
        sa.Column("tokens_json", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.UniqueConstraint("source", "clause_id", name="uq_clause_syntax_source_clause"),
    )
    op.create_index("ix_clause_ref", "clause_syntax", ["book", "chapter", "verse_start"])
    op.create_index("ix_clause_book_num", "clause_syntax", ["book_num"])
    op.create_index("ix_clause_role", "clause_syntax", ["role"])
    op.create_index("ix_clause_verb_tvm", "clause_syntax", ["verb_tense", "verb_voice", "verb_mood"])


def downgrade() -> None:
    if _has_table("clause_syntax"):
        op.drop_index("ix_clause_verb_tvm", table_name="clause_syntax")
        op.drop_index("ix_clause_role", table_name="clause_syntax")
        op.drop_index("ix_clause_book_num", table_name="clause_syntax")
        op.drop_index("ix_clause_ref", table_name="clause_syntax")
        op.drop_table("clause_syntax")
