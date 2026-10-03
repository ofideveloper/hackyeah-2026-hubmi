from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import OrganizationalUnit, Report, User
from app.schemas import ReportCreate, ReportPublic

router = APIRouter(prefix="/reports", tags=["reports"])


def to_public(report: Report) -> ReportPublic:
    return ReportPublic(
        id=report.id,
        author_id=report.author_id,
        unit_id=report.unit_id,
        unit_name=report.unit.name if report.unit else None,
        kind=report.kind,
        title=report.title,
        description=report.description,
        created_at=report.created_at,
    )


@router.get("", response_model=list[ReportPublic])
def list_my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReportPublic]:
    rows = (
        db.scalars(
            select(Report)
            .options(joinedload(Report.unit))
            .where(Report.author_id == current_user.id)
            .order_by(Report.created_at.desc())
        )
        .unique()
        .all()
    )
    return [to_public(r) for r in rows]


@router.post("", response_model=ReportPublic, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportPublic:
    unit = db.get(OrganizationalUnit, payload.unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wybrana jednostka nie istnieje",
        )

    report = Report(
        author_id=current_user.id,
        unit_id=unit.id,
        kind=payload.kind,
        title=payload.title.strip(),
        description=payload.description.strip(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    report.unit = unit
    return to_public(report)
