"""Bible Study Builder — CRUD for personal study projects and sections."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
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
    title: str | None = None
    passage_ref: str | None = None
    study_type: str | None = None


class SectionUpsert(BaseModel):
    content: str


class StudySectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    section_type: str
    content: str
    updated_at: datetime


class StudyProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    passage_ref: str
    study_type: str
    created_at: datetime
    updated_at: datetime
    sections: list[StudySectionOut]


class StudyProjectListOut(BaseModel):
    studies: list[StudyProjectOut]


class SectionOut(BaseModel):
    section_type: str
    content: str


@router.get("", response_model=StudyProjectListOut)
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
    return StudyProjectListOut(studies=result.scalars().all())


@router.post("", status_code=201, response_model=StudyProjectOut)
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
    return project


@router.get("/{project_id}", response_model=StudyProjectOut)
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
    return p


@router.patch("/{project_id}", response_model=StudyProjectOut)
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
    p.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(p)
    return p


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


@router.put("/{project_id}/sections/{section_type}", response_model=SectionOut)
async def upsert_section(
    project_id: int,
    section_type: str,
    body: SectionUpsert,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    VALID_TYPES = {"observations", "cross_refs", "application", "application_questions", "discussion_questions", "prayer", "notes"}
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
        section.updated_at = datetime.now(UTC)
    else:
        section = StudySection(project_id=project_id, section_type=section_type, content=body.content)
        db.add(section)

    proj.updated_at = datetime.now(UTC)
    await db.commit()
    return SectionOut(section_type=section_type, content=body.content)
