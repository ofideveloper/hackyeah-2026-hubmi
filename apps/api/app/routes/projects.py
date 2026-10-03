import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import col, select

from ..dependencies.auth import CurrentUserDep, get_current_user
from ..dependencies.db import SessionDep
from ..models import (
    ActualProject,
    ActualProjectCreate,
    CategoriesOfProjects,
    OrganizationalUnit,
    ProjectProposal,
    ProjectProposalCreate,
    ProjectProposalPublic,
    UnitProject,
    UnitProjectPublic,
)

router = APIRouter(
    tags=["projects"],
    dependencies=[Depends(get_current_user)],
)


def _unit_project_public(session: SessionDep, project: UnitProject) -> UnitProjectPublic:
    unit = session.get(OrganizationalUnit, project.unit_id)
    return UnitProjectPublic(
        id=project.id,
        unit_id=project.unit_id,
        unit_name=unit.name if unit else None,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


@router.get("/projects", response_model=list[UnitProjectPublic])
async def list_unit_projects(
    session: SessionDep,
    unit_id: uuid.UUID | None = None,
) -> list[UnitProjectPublic]:
    query = select(UnitProject).order_by(col(UnitProject.created_at).desc())
    if unit_id is not None:
        query = query.where(UnitProject.unit_id == unit_id)
    rows = session.exec(query).all()
    return [_unit_project_public(session, row) for row in rows]


@router.post(
    "/actual-projects",
    response_model=ActualProject,
    status_code=status.HTTP_201_CREATED,
)
async def create_actual_project(
    payload: ActualProjectCreate,
    session: SessionDep,
):
    """Katalog ActualProject (chat / scraper) — osobno od projektów jednostek."""
    if session.get(CategoriesOfProjects, payload.category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategoria projektu nie istnieje",
        )
    project = ActualProject.model_validate(payload)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.post(
    "/project-proposals",
    response_model=ProjectProposalPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_proposal(
    payload: ProjectProposalCreate,
    user: CurrentUserDep,
    session: SessionDep,
) -> ProjectProposalPublic:
    """Propozycja nowego projektu z czatu (brak dopasowania w katalogu) → kolejka admina."""
    proposal = ProjectProposal(
        author_id=user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
    )
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    return ProjectProposalPublic(
        id=proposal.id,
        author_id=proposal.author_id,
        author_email=user.email,
        author_name=f"{user.name} {user.surname}".strip() or None,
        name=proposal.name,
        description=proposal.description,
        status=proposal.status,
        created_at=proposal.created_at,
    )
