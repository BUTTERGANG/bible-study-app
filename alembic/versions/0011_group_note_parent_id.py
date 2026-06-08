"""Add parent_id column to group_notes for threaded replies.

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-08

parent_id is a self-referential FK to group_notes.id with ON DELETE CASCADE,
so deleting a parent note cascades to all its replies.
"""

from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("group_notes", recreate="always") as batch_op:
        batch_op.add_column(
            sa.Column("parent_id", sa.Integer(), nullable=True),
        )
        batch_op.create_index("ix_group_notes_parent_id", ["parent_id"])
        batch_op.create_foreign_key(
            "fk_group_notes_parent_id",
            "group_notes",
            ["parent_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("group_notes", recreate="always") as batch_op:
        batch_op.drop_constraint("fk_group_notes_parent_id", type_="foreignkey")
        batch_op.drop_index("ix_group_notes_parent_id")
        batch_op.drop_column("parent_id")
