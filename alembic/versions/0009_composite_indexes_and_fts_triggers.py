"""Add composite indexes for hot queries and FTS5 sync triggers for library search.

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-04

Changes:
* ix_note_user_book_chapter     — speeds up per-chapter note fetches
* ix_highlight_user_book_chapter — speeds up per-chapter highlight fetches
* ix_plan_days_plan_date         — speeds up today/dashboard reading plan queries
* library_pages_fts sync triggers — keeps FTS5 index in sync with writes
"""

from sqlalchemy import inspect as sa_inspect

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def _has_index(table: str, index_name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return any(ix["name"] == index_name for ix in inspector.get_indexes(table))


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    # ── Composite indexes ──────────────────────────────────────────────────
    if not _has_index("notes", "ix_note_user_book_chapter"):
        op.create_index("ix_note_user_book_chapter", "notes", ["user_id", "book", "chapter"])

    if not _has_index("highlights", "ix_highlight_user_book_chapter"):
        op.create_index("ix_highlight_user_book_chapter", "highlights", ["user_id", "book", "chapter"])

    if not _has_index("reading_plan_days", "ix_plan_days_plan_date"):
        op.create_index("ix_plan_days_plan_date", "reading_plan_days", ["plan_id", "date"])

    # ── FTS5 sync triggers for library_pages ──────────────────────────────
    # Without these, rows inserted after migration 0005 are invisible to search.
    if _has_table("library_pages_fts"):
        op.execute("""
            CREATE TRIGGER IF NOT EXISTS library_pages_ai
            AFTER INSERT ON library_pages BEGIN
                INSERT INTO library_pages_fts(rowid, text) VALUES (new.id, new.text);
            END
        """)
        op.execute("""
            CREATE TRIGGER IF NOT EXISTS library_pages_ad
            AFTER DELETE ON library_pages BEGIN
                INSERT INTO library_pages_fts(library_pages_fts, rowid, text)
                    VALUES('delete', old.id, old.text);
            END
        """)
        op.execute("""
            CREATE TRIGGER IF NOT EXISTS library_pages_au
            AFTER UPDATE ON library_pages BEGIN
                INSERT INTO library_pages_fts(library_pages_fts, rowid, text)
                    VALUES('delete', old.id, old.text);
                INSERT INTO library_pages_fts(rowid, text) VALUES (new.id, new.text);
            END
        """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS library_pages_au")
    op.execute("DROP TRIGGER IF EXISTS library_pages_ad")
    op.execute("DROP TRIGGER IF EXISTS library_pages_ai")

    op.execute("DROP INDEX IF EXISTS ix_plan_days_plan_date")
    op.execute("DROP INDEX IF EXISTS ix_highlight_user_book_chapter")
    op.execute("DROP INDEX IF EXISTS ix_note_user_book_chapter")
