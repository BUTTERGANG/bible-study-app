"""Bible Study Builder — CRUD for personal study projects and sections."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import StudyProject, StudySection

router = APIRouter(prefix="/api/studies", tags=["studies"])


class StudyCreate(BaseModel):
    title: str
    passage_ref: str
    study_type: str = "inductive"


class StudyUpdate(BaseModel):
    title: Optional[str] = None
    passage_ref: Optional[str] = None
    study_type: Optional[str] = None


class SectionUpsert(BaseModel):
    content: str


def _project_out(p: StudyProject) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "passage_ref": p.passage_ref,
        "study_type": p.study_type,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
        "sections": [
            {"section_type": s.section_type, "content": s.content, "updated_at": s.updated_at.isoformat()}
            for s in (p.sections or [])
        ],
    }


@router.get("")
async def list_studies(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(StudyProject)
        .options(selectinload(StudyProject.sections))
        .where(StudyProject.user_id == user.id)
        .order_by(StudyProject.updated_at.desc())
    )
    return {"studies": [_project_out(p) for p in result.scalars().all()]}


@router.post("", status_code=201)
async def create_study(
    body: StudyCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    project = StudyProject(
        user_id=user.id,
        title=body.title,
        passage_ref=body.passage_ref,
        study_type=body.study_type,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    project.sections = []
    return _project_out(project)


@router.get("/{project_id}")
async def get_study(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(StudyProject)
        .options(selectinload(StudyProject.sections))
        .where(StudyProject.id == project_id, StudyProject.user_id == user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Study not found")
    return _project_out(p)


@router.patch("/{project_id}")
async def update_study(
    project_id: int,
    body: StudyUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(StudyProject)
        .options(selectinload(StudyProject.sections))
        .where(StudyProject.id == project_id, StudyProject.user_id == user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Study not found")
    if body.title is not None:
        p.title = body.title
    if body.passage_ref is not None:
        p.passage_ref = body.passage_ref
    if body.study_type is not None:
        p.study_type = body.study_type
    p.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(p)
    return _project_out(p)


@router.delete("/{project_id}", status_code=204)
async def delete_study(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(StudyProject).where(StudyProject.id == project_id, StudyProject.user_id == user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Study not found")
    await db.delete(p)
    await db.commit()


@router.put("/{project_id}/sections/{section_type}")
async def upsert_section(
    project_id: int,
    section_type: str,
    body: SectionUpsert,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    VALID_TYPES = {"observations", "cross_refs", "application", "prayer", "notes"}
    if section_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid section_type. Must be one of: {', '.join(VALID_TYPES)}")

    proj_result = await db.execute(
        select(StudyProject).where(StudyProject.id == project_id, StudyProject.user_id == user.id)
    )
    proj = proj_result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Study not found")

    existing = await db.execute(
        select(StudySection).where(
            StudySection.project_id == project_id,
            StudySection.section_type == section_type,
        )
    )
    section = existing.scalar_one_or_none()
    if section:
        section.content = body.content
        section.updated_at = datetime.utcnow()
    else:
        section = StudySection(project_id=project_id, section_type=section_type, content=body.content)
        db.add(section)

    proj.updated_at = datetime.utcnow()
    await db.commit()
    return {"section_type": section_type, "content": body.content}
