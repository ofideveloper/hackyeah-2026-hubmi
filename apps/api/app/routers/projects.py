from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_admin, get_current_user
from app.database import get_db
from app.models import OrganizationalUnit, Project, User
from app.schemas import ProjectCreate, ProjectPublic, ProjectUpdate

router = APIRouter(tags=["projects"])


def to_public(project: Project) -> ProjectPublic:
    return ProjectPublic(
        id=project.id,
        unit_id=project.unit_id,
        unit_name=project.unit.name if project.unit else None,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


@router.get("/projects", response_model=list[ProjectPublic])
def list_projects(
    unit_id: int | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectPublic]:
    query = select(Project).options(joinedload(Project.unit)).order_by(Project.created_at.desc())
    if unit_id is not None:
        query = query.where(Project.unit_id == unit_id)
    rows = db.scalars(query).unique().all()
    return [to_public(p) for p in rows]


@router.post("/admin/projects", response_model=ProjectPublic, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProjectPublic:
    unit = db.get(OrganizationalUnit, payload.unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wybrana jednostka nie istnieje",
        )

    project = Project(
        unit_id=unit.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    project.unit = unit
    return to_public(project)


@router.patch("/admin/projects/{project_id}", response_model=ProjectPublic)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProjectPublic:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono projektu")

    if payload.unit_id is not None:
        unit = db.get(OrganizationalUnit, payload.unit_id)
        if not unit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wybrana jednostka nie istnieje",
            )
        project.unit_id = unit.id
        project.unit = unit

    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description.strip()

    db.commit()
    db.refresh(project)
    if project.unit is None:
        project.unit = db.get(OrganizationalUnit, project.unit_id)
    return to_public(project)


@router.delete("/admin/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono projektu")
    db.delete(project)
    db.commit()
