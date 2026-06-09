"""Add textual_variants table and seed data.

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-29

Changes:
* `textual_variants` — curated dataset of ~30 theologically significant
  manuscript variants/disputed passages with manuscript support and plain-
  English explanations.
"""

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision: str = "0011"
down_revision: str = "0010"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("textual_variants"):
        op.create_table(
            "textual_variants",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("book", sa.String(50), nullable=False, index=True),
            sa.Column("chapter_start", sa.Integer(), nullable=False, index=True),
            sa.Column("verse_start", sa.Integer(), nullable=False),
            sa.Column("chapter_end", sa.Integer(), nullable=False),
            sa.Column("verse_end", sa.Integer(), nullable=False),
            sa.Column("short_title", sa.String(200), nullable=False),
            sa.Column("manuscript_support", sa.Text(), nullable=False),
            sa.Column("significance", sa.String(20), nullable=False, server_default="medium"),
            sa.Column("explanation", sa.Text(), nullable=False),
            sa.Column("external_ref", sa.String(300), nullable=True),
        )
        op.create_index("ix_tv_lookup", "textual_variants", ["book", "chapter_start", "verse_start"])

    # Seed from JSON — idempotent (skip if rows already exist)
    bind = op.get_bind()
    count = bind.execute(sa.text("SELECT COUNT(*) FROM textual_variants")).scalar()
    if count == 0:
        seed_path = Path(__file__).parent.parent.parent / "backend" / "data" / "textual_variants.json"
        with open(seed_path, encoding="utf-8") as f:
            rows = json.load(f)
        if rows:
            bind.execute(
                sa.text(
                    "INSERT INTO textual_variants "
                    "(book, chapter_start, verse_start, chapter_end, verse_end, "
                    "short_title, manuscript_support, significance, explanation, external_ref) "
                    "VALUES (:book, :chapter_start, :verse_start, :chapter_end, :verse_end, "
                    ":short_title, :manuscript_support, :significance, :explanation, :external_ref)"
                ),
                rows,
            )


def downgrade() -> None:
    op.drop_table("textual_variants")
