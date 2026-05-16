"""Initial schema + post-refactor changes.

Revision ID: 0001
Revises:
Create Date: 2026-05-15

Idempotent baseline. The Bible/commentary/lexicon content tables already exist
in production (loaded from data/bible.db) — we only need to ensure the
user-mutable schema reflects current models:

* Highlights gets a UNIQUE(translation, book, chapter, verse) constraint.
* Notes drops the denormalized `reference` column (introduced before book/
  chapter/verse were stored separately).
* ReadingPlan drops `schedule_json`; a new `reading_plan_days` table holds
  the normalized schedule.
* ReadingPlanProgress gets a UNIQUE(plan_id, date, reference) for upserts.
* A new `library_pages` table stores pre-extracted PDF text.

For a fresh install, the app's `init_db()` will create every table from
metadata. This migration brings an existing DB into the same state.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    bind = op.get_bind()
    return name in inspect(bind).get_table_names()


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    cols = [c["name"] for c in inspect(bind).get_columns(table)]
    return column in cols


def _has_unique(table: str, name: str) -> bool:
    bind = op.get_bind()
    return any(uc["name"] == name for uc in inspect(bind).get_unique_constraints(table))


def upgrade() -> None:
    # --- Notes: drop denormalized `reference` column if present.
    if _has_table("notes") and _has_column("notes", "reference"):
        with op.batch_alter_table("notes") as batch:
            batch.drop_column("reference")

    # --- Highlights: add unique constraint.
    if _has_table("highlights") and not _has_unique("highlights", "uq_highlight_verse"):
        with op.batch_alter_table("highlights") as batch:
            batch.create_unique_constraint(
                "uq_highlight_verse",
                ["translation", "book", "chapter", "verse"],
            )

    # --- Bookmarks: drop `reference` column if present.
    if _has_table("bookmarks") and _has_column("bookmarks", "reference"):
        with op.batch_alter_table("bookmarks") as batch:
            batch.drop_column("reference")

    # --- ReadingPlan: drop schedule_json; reading_plan_days replaces it.
    if _has_table("reading_plans") and _has_column("reading_plans", "schedule_json"):
        with op.batch_alter_table("reading_plans") as batch:
            batch.drop_column("schedule_json")

    if not _has_table("reading_plan_days"):
        op.create_table(
            "reading_plan_days",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("plan_id", sa.Integer, sa.ForeignKey("reading_plans.id"), index=True),
            sa.Column("date", sa.String(10), index=True),
            sa.Column("reference", sa.String(100)),
            sa.UniqueConstraint("plan_id", "date", "reference", name="uq_plan_day_ref"),
        )

    # --- ReadingPlanProgress: unique constraint for upserts.
    if _has_table("reading_plan_progress") and not _has_unique(
        "reading_plan_progress", "uq_progress_entry"
    ):
        with op.batch_alter_table("reading_plan_progress") as batch:
            batch.create_unique_constraint(
                "uq_progress_entry", ["plan_id", "date", "reference"]
            )

    # --- LibraryPage: pre-extracted PDF text.
    if not _has_table("library_pages"):
        op.create_table(
            "library_pages",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("book_id", sa.Integer, sa.ForeignKey("library_books.id"), index=True),
            sa.Column("page_num", sa.Integer, index=True),
            sa.Column("text", sa.Text),
            sa.UniqueConstraint("book_id", "page_num", name="uq_library_page"),
        )

    # --- Drop the now-unused `studies` table.
    if _has_table("studies"):
        op.drop_table("studies")


def downgrade() -> None:
    """No-op. The initial baseline only ever moves forward; a downgrade would
    have to fabricate denormalized columns and a schedule_json blob, which
    isn't useful in practice."""
    pass
