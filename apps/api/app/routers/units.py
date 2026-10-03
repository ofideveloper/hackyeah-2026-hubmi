from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_admin, get_current_user
from app.database import get_db
from app.models import OrganizationalUnit, Project, Report, User
from app.schemas import UnitCreate, UnitPublic

router = APIRouter(tags=["units"])


@router.get("/units", response_model=list[UnitPublic])
def list_units(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrganizationalUnit]:
    return list(db.scalars(select(OrganizationalUnit).order_by(OrganizationalUnit.name)).all())


@router.post("/admin/units", response_model=UnitPublic, status_code=status.HTTP_201_CREATED)
def create_unit(
    payload: UnitCreate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> OrganizationalUnit:
    existing = db.scalar(
        select(OrganizationalUnit).where(OrganizationalUnit.name == payload.name.strip())
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jednostka o tej nazwie już istnieje",
        )

    unit = OrganizationalUnit(
        name=payload.name.strip(),
        territory=payload.territory.strip(),
        competencies=payload.competencies.strip(),
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.delete("/admin/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(
    unit_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    unit = db.get(OrganizationalUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono jednostki")
    for report in db.scalars(select(Report).where(Report.unit_id == unit_id)).all():
        db.delete(report)
    for project in db.scalars(select(Project).where(Project.unit_id == unit_id)).all():
        db.delete(project)
    db.delete(unit)
    db.commit()
