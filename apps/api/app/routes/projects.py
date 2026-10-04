import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies.auth import CurrentAdminDep, CurrentUserDep, get_current_user
from ..dependencies.db import SessionDep
from ..models import (
    ActualProject,
    ActualProjectCreate,
    CategoriesOfProjects,
    ProjectProposal,
    ProjectProposalCreate,
    ProjectProposalPublic,
)

router = APIRouter(
    tags=["projects"],
    dependencies=[Depends(get_current_user)],
)


@router.post(
    "/actual-projects",
    response_model=ActualProject,
    status_code=status.HTTP_201_CREATED,
)
async def create_actual_project(
    payload: ActualProjectCreate,
    _: CurrentAdminDep,
    session: SessionDep,
):
    """Dodaje innowację do katalogu ActualProject (obok scrapera).

    Tylko admin: opisy z katalogu trafiają do promptu czatu.
    """
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
