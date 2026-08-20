"""Add users table and user_id to user-mutable tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-21

Changes:
* New `users` table (id, email, password_hash, is_active, created_at).
* Add `user_id` column (default 0) to notes, highlights, bookmarks, reading_plans.
* Rebuild highlights unique constraint to include user_id:
  (translation, book, chapter, verse) → (user_id, translation, book, chapter, verse).

Existing rows get user_id=0 (the legacy/open-mode sentinel), so all existing
data remains visible to unauthenticated and APP_PASSWORD sessions.
"""

from typing import Union

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in inspect(op.get_bind()).get_table_names()


def _has_column(table: str, column: str) -> bool:
    cols = [c["name"] for c in inspect(op.get_bind()).get_columns(table)]
    return column in cols


def _has_unique(table: str, name: str) -> bool:
    return any(
        uc["name"] == name
        for uc in inspect(op.get_bind()).get_unique_constraints(table)
    )


def upgrade() -> None:
    # --- Create users table
    if not _has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("email", sa.String(254), nullable=False, unique=True, index=True),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime, nullable=True),
        )

    # --- Add user_id to notes
    if _has_table("notes") and not _has_column("notes", "user_id"):
        with op.batch_alter_table("notes") as batch:
            batch.add_column(sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, server_default="0"))

    # --- Add user_id to bookmarks
    if _has_table("bookmarks") and not _has_column("bookmarks", "user_id"):
        with op.batch_alter_table("bookmarks") as batch:
            batch.add_column(sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, server_default="0"))

    # --- Add user_id to reading_plans
    if _has_table("reading_plans") and not _has_column("reading_plans", "user_id"):
        with op.batch_alter_table("reading_plans") as batch:
            batch.add_column(sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, server_default="0"))

    # --- Rebuild highlights: add user_id and update unique constraint
    if _has_table("highlights"):
        if not _has_column("highlights", "user_id"):
            with op.batch_alter_table("highlights") as batch:
                batch.add_column(
                    sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, server_default="0")
                )

        # Drop old constraint and replace with user_id-scoped one
        if _has_unique("highlights", "uq_highlight_verse"):
            with op.batch_alter_table("highlights") as batch:
                batch.drop_constraint("uq_highlight_verse", type_="unique")

        if not _has_unique("highlights", "uq_highlight_verse"):
            with op.batch_alter_table("highlights") as batch:
                batch.create_unique_constraint(
                    "uq_highlight_verse",
                    ["user_id", "translation", "book", "chapter", "verse"],
                )


def downgrade() -> None:
    pass
