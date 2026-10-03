from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_admin, get_current_user
from app.database import get_db
from app.models import OrganizationalUnit, Report, ReportStatus, User
from app.schemas import ReportCreate, ReportPublic, ReportStatusUpdate

router = APIRouter(tags=["reports"])


def to_public(report: Report) -> ReportPublic:
    return ReportPublic(
        id=report.id,
        author_id=report.author_id,
        unit_id=report.unit_id,
        unit_name=report.unit.name if report.unit else None,
        kind=report.kind,
        status=getattr(report, "status", None) or ReportStatus.NEW.value,
        title=report.title,
        description=report.description,
        created_at=report.created_at,
    )


@router.get("/reports", response_model=list[ReportPublic])
def list_my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReportPublic]:
    """Mieszkaniec — tylko podgląd własnych spraw i statusów."""
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


@router.get("/admin/reports", response_model=list[ReportPublic])
def list_all_reports(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[ReportPublic]:
    rows = (
        db.scalars(
            select(Report)
            .options(joinedload(Report.unit))
            .order_by(Report.created_at.desc())
        )
        .unique()
        .all()
    )
    return [to_public(r) for r in rows]


@router.patch("/admin/reports/{report_id}", response_model=ReportPublic)
def update_report_status(
    report_id: int,
    payload: ReportStatusUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ReportPublic:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono sprawy")
    report.status = payload.status
    db.commit()
    db.refresh(report)
    if report.unit is None:
        report.unit = db.get(OrganizationalUnit, report.unit_id)
    return to_public(report)


@router.post("/reports", response_model=ReportPublic, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportPublic:
    """Endpoint pod AI / system — nie eksponujemy formularza w UI mieszkańca."""
    unit = db.get(OrganizationalUnit, payload.unit_id)
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wybrana jednostka nie istnieje",
        )

    author_id = current_user.id
    if payload.author_id is not None and current_user.is_admin:
        author_id = payload.author_id

    report = Report(
        author_id=author_id,
        unit_id=unit.id,
        kind=payload.kind,
        status=ReportStatus.NEW.value,
        title=payload.title.strip(),
        description=payload.description.strip(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    report.unit = unit
    return to_public(report)
