"""Add original language course tables.

Revision ID: 0014_language_courses
Revises: 0013
Create Date: 2026-06-08
"""

import sqlalchemy as sa

from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _has_table("language_courses"):
        op.create_table(
            "language_courses",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("language", sa.String(10), nullable=False, index=True),
            sa.Column("slug", sa.String(50), nullable=False, index=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("total_units", sa.Integer(), server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("language", "slug", name="uq_course_lang_slug"),
        )

    if not _has_table("course_units"):
        op.create_table(
            "course_units",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("language_courses.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("unit_number", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.UniqueConstraint("course_id", "unit_number", name="uq_unit_number"),
        )

    if not _has_table("course_lessons"):
        op.create_table(
            "course_lessons",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("unit_id", sa.Integer(), sa.ForeignKey("course_units.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("lesson_number", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("instruction", sa.Text(), nullable=False),
            sa.Column("paradigm_table", sa.Text(), nullable=True),
            sa.UniqueConstraint("unit_id", "lesson_number", name="uq_lesson_number"),
        )

    if not _has_table("lesson_exercises"):
        op.create_table(
            "lesson_exercises",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("course_lessons.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("order", sa.Integer(), nullable=False),
            sa.Column("exercise_type", sa.String(30), nullable=False),
            sa.Column("prompt", sa.Text(), nullable=False),
            sa.Column("answer", sa.Text(), nullable=False),
            sa.Column("distractors", sa.Text(), nullable=True),
            sa.Column("hint", sa.String(300), nullable=True),
        )

    if not _has_table("user_course_progress"):
        op.create_table(
            "user_course_progress",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("language_courses.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("current_unit", sa.Integer(), server_default="1"),
            sa.Column("current_lesson", sa.Integer(), server_default="1"),
            sa.Column("completed_lesson_ids", sa.Text(), server_default="[]"),
            sa.Column("percent_complete", sa.Float(), server_default="0"),
            sa.Column("current_streak", sa.Integer(), server_default="0"),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "course_id", name="uq_user_course"),
        )


def downgrade() -> None:
    for table in [
        "user_course_progress",
        "lesson_exercises",
        "course_lessons",
        "course_units",
        "language_courses",
    ]:
        if _has_table(table):
            op.drop_table(table)
