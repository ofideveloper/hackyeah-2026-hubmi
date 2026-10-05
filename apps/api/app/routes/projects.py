import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import get_settings
from ..dependencies.auth import CurrentAdminDep, CurrentUserDep, get_current_user
from ..dependencies.db import SessionDep
from ..dependencies.logger import get_logger
from ..models import (
    ActualProject,
    ActualProjectCreate,
    CategoriesOfProjects,
    ProjectProposal,
    ProjectProposalCreate,
    ProjectProposalPublic,
)
from ..project_brief import brief_from_description, refine_brief_with_llm
from .chat import ask_llm

router = APIRouter(
    tags=["projects"],
    dependencies=[Depends(get_current_user)],
)
logger = get_logger(__name__)


async def _brief_for_new_project(name: str, description: str) -> str:
    """Skrót do czatu: LLM przy prawdziwym kluczu, inaczej szybka heurystyka."""
    heuristic = brief_from_description(name, description)
    settings = get_settings()
    provider = (settings.llm_provider or "").strip().lower()
    key = (settings.llm_api_key or "").strip()
    if provider == "fake" or not key:
        return heuristic
    return await refine_brief_with_llm(
        ask_llm, name, description, fallback=heuristic
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

    Tylko admin: skrót `brief` trafia do promptu czatu, pełny opis — do kart FE.
    """
    if session.get(CategoriesOfProjects, payload.category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategoria projektu nie istnieje",
        )
    project = ActualProject.model_validate(payload)
    # Klient może przesłać pusty brief — zawsze budujemy po stronie serwera.
    project.brief = await _brief_for_new_project(project.name, project.description)
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
