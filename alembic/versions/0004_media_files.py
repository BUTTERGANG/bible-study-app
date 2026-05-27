"""Add media_files table for inline media in notes.

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-26

Changes:
* New `media_files` table (user_id, note_id, filename, original_filename,
  mime_type, file_size, storage_path, caption, width, height, created_at).
* Indexes on user_id and note_id for fast lookups.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    if _has_table("media_files"):
        return

    op.create_table(
        "media_files",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, server_default="0", index=True),
        sa.Column("note_id", sa.Integer, sa.ForeignKey("notes.id"), nullable=True, index=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("caption", sa.String(500), nullable=True),
        sa.Column("width", sa.Integer, nullable=True),
        sa.Column("height", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    if _has_table("media_files"):
        op.drop_table("media_files")
