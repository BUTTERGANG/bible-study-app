"""Sermon Builder — CRUD for sermon projects and their sections."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import SermonProject, SermonSection

router = APIRouter(prefix="/api/sermons", tags=["sermons"])


class ProjectCreate(BaseModel):
    title: str
    passage_ref: str
    audience: str = "general"


class ProjectUpdate(BaseModel):
    title: str | None = None
    passage_ref: str | None = None
    audience: str | None = None


class SectionUpsert(BaseModel):
    content: str


def _project_out(p: SermonProject) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "passage_ref": p.passage_ref,
        "audience": p.audience,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
        "sections": [
            {"section_type": s.section_type, "content": s.content, "updated_at": s.updated_at.isoformat()}
            for s in (p.sections or [])
        ],
    }


@router.get("")
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(SermonProject)
        .options(selectinload(SermonProject.sections))
        .where(SermonProject.user_id == user.id)
        .order_by(SermonProject.updated_at.desc())
    )
    projects = result.scalars().all()
    return {"projects": [_project_out(p) for p in projects]}


@router.post("", status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    project = SermonProject(
        title=body.title,
        passage_ref=body.passage_ref,
        audience=body.audience,
        user_id=user.id,
    )
    db.add(project)
    await db.commit()
    # Re-fetch with sections loaded to avoid lazy-load in async context.
    result = await db.execute(
        select(SermonProject)
        .options(selectinload(SermonProject.sections))
        .where(SermonProject.id == project.id)
    )
    project = result.scalar_one()
    return _project_out(project)


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(SermonProject)
        .options(selectinload(SermonProject.sections))
        .where(SermonProject.id == project_id, SermonProject.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Sermon project not found")
    return _project_out(project)


@router.patch("/{project_id}")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(SermonProject)
        .options(selectinload(SermonProject.sections))
        .where(SermonProject.id == project_id, SermonProject.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Sermon project not found")
    if body.title is not None:
        project.title = body.title
    if body.passage_ref is not None:
        project.passage_ref = body.passage_ref
    if body.audience is not None:
        project.audience = body.audience
    project.updated_at = datetime.now(UTC)
    await db.commit()
    # Re-fetch with sections eagerly loaded to avoid lazy-load in async context
    result2 = await db.execute(
        select(SermonProject)
        .options(selectinload(SermonProject.sections))
        .where(SermonProject.id == project.id)
    )
    return _project_out(result2.scalar_one())


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(SermonProject).where(SermonProject.id == project_id, SermonProject.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Sermon project not found")
    await db.delete(project)
    await db.commit()


@router.put("/{project_id}/sections/{section_type}")
async def upsert_section(
    project_id: int,
    section_type: str,
    body: SectionUpsert,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    VALID_TYPES = {"outline", "illustrations", "questions", "applications", "full_sermon"}
    if section_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid section_type. Must be one of: {', '.join(VALID_TYPES)}")

    proj_result = await db.execute(
        select(SermonProject).where(SermonProject.id == project_id, SermonProject.user_id == user.id)
    )
    proj = proj_result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Sermon project not found")

    existing = await db.execute(
        select(SermonSection).where(
            SermonSection.project_id == project_id,
            SermonSection.section_type == section_type,
        )
    )
    section = existing.scalar_one_or_none()
    if section:
        section.content = body.content
        section.updated_at = datetime.now(UTC)
    else:
        section = SermonSection(project_id=project_id, section_type=section_type, content=body.content)
        db.add(section)

    proj.updated_at = datetime.now(UTC)
    await db.commit()
    return {"section_type": section_type, "content": body.content}
