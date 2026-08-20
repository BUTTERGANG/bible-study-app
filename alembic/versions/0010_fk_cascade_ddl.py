"""Rebuild user-data tables with correct ON DELETE CASCADE DDL.

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-04

SQLite stores FK actions in table DDL at creation time. Migrations 0001–0008
created tables with plain ForeignKey(...) — no ON DELETE action. This means
deleting a user raises a FK constraint error instead of cascading. models.py
already declares ondelete="CASCADE" on all FK columns; this migration rebuilds
each affected table so the DDL matches.

Alembic batch mode with recreate="always" drops and recreates the table using
the current metadata (which includes the correct FK actions).
"""

from sqlalchemy import inspect as sa_inspect

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

# Tables with user_id or parent FK that need CASCADE DDL.
# Order matters — child tables first (those referencing other user tables).
TABLES_TO_REBUILD = [
    # Children of sermon_projects / study_projects — must go before parents
    "sermon_sections",
    "study_project_sections",
    "sermon_series_entries",
    # Children of reading_plans
    "reading_plan_days",
    "reading_plan_progress",
    # Direct children of users
    "notes",
    "highlights",
    "bookmarks",
    "annotations",
    "reading_plans",
    "prayer_entries",
    "memory_verses",
    "sermon_projects",
    "sermon_series",
    "study_projects",
    "ai_conversations",
    "media_files",
    "word_study_entries",
    "doctrine_entries",
    # Groups tables
    "group_members",
    "group_invites",
    "group_notes",
    "group_shared_items",
]


def _has_table(name: str) -> bool:
    inspector = sa_inspect(op.get_bind())
    return name in inspector.get_table_names()


def upgrade() -> None:
    for table in TABLES_TO_REBUILD:
        if _has_table(table):
            # recreate="always" drops and recreates the table from current
            # metadata, picking up the correct ON DELETE actions.
            with op.batch_alter_table(table, recreate="always"):
                pass  # no column changes — pure DDL rebuild


def downgrade() -> None:
    # CASCADE → NO ACTION would require another rebuild; not worth implementing.
    pass
