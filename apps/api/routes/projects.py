from fastapi import APIRouter, HTTPException, status

from ..dependencies.db import SessionDep
from ..models import ActualProject, ActualProjectCreate, CategoriesOfProjects

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ActualProject, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ActualProjectCreate,
    session: SessionDep,
):
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
