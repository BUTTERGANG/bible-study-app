"""Add groups tables: groups, group_members, group_invites, group_notes, group_shared_items.

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-29

Changes:
* `groups` — name, description, owner_id, invite_code, timestamps.
* `group_members` — group_id + user_id unique pair, role (owner|member), joined_at.
* `group_invites` — group_id + email unique pair, invited_by, status, timestamps.
* `group_notes` — group_id, author_id, optional book/chapter/verse, content, tags.
* `group_shared_items` — group_id, user_id, item_type/item_id polymorphic link, annotation.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision: str = "0006"
down_revision: Union[str, None] = "0005_library_pages_fts_and_fk_cascades"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    # ── groups ───────────────────────────────────────────────────────────
    if not _has_table("groups"):
        op.create_table(
            "groups",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("name", sa.String(150), nullable=False),
            sa.Column("description", sa.String(500), nullable=True, server_default=""),
            sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("invite_code", sa.String(20), unique=True, index=True, server_default=""),
            sa.Column("created_at", sa.DateTime, nullable=True),
            sa.Column("updated_at", sa.DateTime, nullable=True),
        )

    # ── group_members ────────────────────────────────────────────────────
    if not _has_table("group_members"):
        op.create_table(
            "group_members",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id"), nullable=False, index=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("role", sa.String(10), server_default="member"),
            sa.Column("joined_at", sa.DateTime, nullable=True),
        )
        op.create_unique_constraint("uq_group_member", "group_members", ["group_id", "user_id"])
        op.create_index("ix_group_members_user_id", "group_members", ["user_id"])

    # ── group_invites ────────────────────────────────────────────────────
    if not _has_table("group_invites"):
        op.create_table(
            "group_invites",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id"), nullable=False, index=True),
            sa.Column("email", sa.String(254), nullable=False, index=True),
            sa.Column("invited_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("status", sa.String(10), server_default="pending"),
            sa.Column("created_at", sa.DateTime, nullable=True),
            sa.Column("responded_at", sa.DateTime, nullable=True),
        )
        op.create_unique_constraint("uq_group_invite", "group_invites", ["group_id", "email"])
        op.create_index("ix_group_invites_email", "group_invites", ["email"])

    # ── group_notes ──────────────────────────────────────────────────────
    if not _has_table("group_notes"):
        op.create_table(
            "group_notes",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id"), nullable=False, index=True),
            sa.Column("author_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("book", sa.String(50), nullable=True, index=True),
            sa.Column("chapter", sa.Integer, nullable=True, index=True),
            sa.Column("verse", sa.Integer, nullable=True, index=True),
            sa.Column("content", sa.Text, nullable=False),
            sa.Column("tags", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=True),
            sa.Column("updated_at", sa.DateTime, nullable=True),
        )

    # ── group_shared_items ───────────────────────────────────────────────
    if not _has_table("group_shared_items"):
        op.create_table(
            "group_shared_items",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id"), nullable=False, index=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("item_type", sa.String(20), nullable=False),
            sa.Column("item_id", sa.Integer, nullable=False),
            sa.Column("shared_at", sa.DateTime, nullable=True),
            sa.Column("annotation", sa.String(500), nullable=True),
        )
        op.create_unique_constraint("uq_group_shared_item", "group_shared_items", ["group_id", "item_type", "item_id"])
        op.create_index("ix_gsi_group_id", "group_shared_items", ["group_id"])
        op.create_index("ix_gsi_user_id", "group_shared_items", ["user_id"])


def downgrade() -> None:
    for name in ("group_shared_items", "group_notes", "group_invites", "group_members", "groups"):
        if _has_table(name):
            op.drop_table(name)
