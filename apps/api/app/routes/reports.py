import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import col, select

from ..dependencies.auth import CurrentUserDep, get_current_user
from ..dependencies.db import SessionDep
from ..models import (
    OrganizationalUnit,
    Report,
    ReportCreate,
    ReportPublic,
    ReportStatus,
    RoleEnum,
)

router = APIRouter(tags=["reports"])


def _report_public(session: SessionDep, report: Report) -> ReportPublic:
    unit = session.get(OrganizationalUnit, report.unit_id)
    return ReportPublic(
        id=report.id,
        author_id=report.author_id,
        unit_id=report.unit_id,
        unit_name=unit.name if unit else None,
        kind=report.kind,
        status=report.status,
        title=report.title,
        description=report.description,
        created_at=report.created_at,
    )


@router.get(
    "/reports",
    response_model=list[ReportPublic],
    dependencies=[Depends(get_current_user)],
)
async def list_my_reports(current_user: CurrentUserDep, session: SessionDep) -> list[ReportPublic]:
    rows = session.exec(
        select(Report)
        .where(Report.author_id == current_user.id)
        .order_by(col(Report.created_at).desc())
    ).all()
    return [_report_public(session, row) for row in rows]


@router.post(
    "/reports",
    response_model=ReportPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_user)],
)
async def create_report(
    payload: ReportCreate,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> ReportPublic:
    unit = session.get(OrganizationalUnit, payload.unit_id)
    if unit is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wybrana jednostka nie istnieje",
        )
    author_id = current_user.id
    if payload.author_id is not None and current_user.role == RoleEnum.ADMIN:
        author_id = payload.author_id
    report = Report(
        author_id=author_id,
        unit_id=unit.id,
        kind=payload.kind,
        status=ReportStatus.NEW,
        title=payload.title.strip(),
        description=payload.description.strip(),
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return _report_public(session, report)
