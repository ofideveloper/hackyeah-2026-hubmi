import uuid

from fastapi import APIRouter, HTTPException, status
from sqlmodel import col, func, select

from ..dependencies.auth import CurrentAdminDep
from ..dependencies.db import SessionDep
from ..models import (
    AdminStats,
    OrganizationalUnit,
    OrganizationalUnitCreate,
    OrganizationalUnitPublic,
    OrganizationalUnitUpdate,
    ProjectProposal,
    ProjectProposalAccept,
    ProjectProposalPublic,
    ProjectProposalStatus,
    Report,
    ReportPublic,
    ReportStatus,
    ReportStatusUpdate,
    RoleEnum,
    UnitProject,
    UnitProjectCreate,
    UnitProjectPublic,
    UnitProjectUpdate,
    User,
    UserPublic,
)

router = APIRouter(prefix="/admin", tags=["admin"])


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


def _proposal_public(session: SessionDep, proposal: ProjectProposal) -> ProjectProposalPublic:
    author = session.get(User, proposal.author_id)
    unit = (
        session.get(OrganizationalUnit, proposal.suggested_unit_id)
        if proposal.suggested_unit_id
        else None
    )
    author_name = None
    if author is not None:
        author_name = f"{author.name} {author.surname}".strip() or None
    return ProjectProposalPublic(
        id=proposal.id,
        author_id=proposal.author_id,
        author_email=author.email if author else None,
        author_name=author_name,
        suggested_unit_id=proposal.suggested_unit_id,
        suggested_unit_name=unit.name if unit else None,
        name=proposal.name,
        description=proposal.description,
        status=proposal.status,
        created_at=proposal.created_at,
    )


def _report_public(session: SessionDep, report: Report) -> ReportPublic:
    unit = (
        session.get(OrganizationalUnit, report.unit_id) if report.unit_id is not None else None
    )
    author = session.get(User, report.author_id)
    author_name = None
    if author is not None:
        author_name = f"{author.name} {author.surname}".strip() or None
    return ReportPublic(
        id=report.id,
        author_id=report.author_id,
        author_email=author.email if author else None,
        author_name=author_name,
        unit_id=report.unit_id,
        unit_name=unit.name if unit else None,
        kind=report.kind,
        status=report.status,
        title=report.title,
        description=report.description,
        created_at=report.created_at,
    )


@router.get("/stats", response_model=AdminStats)
async def stats(_: CurrentAdminDep, session: SessionDep) -> AdminStats:
    users_total = session.exec(select(func.count()).select_from(User)).one()
    admins_total = session.exec(
        select(func.count()).select_from(User).where(User.role == RoleEnum.ADMIN)
    ).one()
    units_total = session.exec(select(func.count()).select_from(OrganizationalUnit)).one()
    reports_total = session.exec(select(func.count()).select_from(Report)).one()
    projects_total = session.exec(select(func.count()).select_from(UnitProject)).one()
    return AdminStats(
        users_total=users_total or 0,
        users_active=users_total or 0,
        admins_total=admins_total or 0,
        units_total=units_total or 0,
        reports_total=reports_total or 0,
        projects_total=projects_total or 0,
    )


@router.get("/users", response_model=list[UserPublic])
async def list_users(_: CurrentAdminDep, session: SessionDep) -> list[User]:
    return list(session.exec(select(User).order_by(col(User.email))).all())


@router.post(
    "/units",
    response_model=OrganizationalUnitPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_unit(
    payload: OrganizationalUnitCreate,
    _: CurrentAdminDep,
    session: SessionDep,
) -> OrganizationalUnit:
    name = payload.name.strip()
    existing = session.exec(
        select(OrganizationalUnit).where(OrganizationalUnit.name == name)
    ).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jednostka o tej nazwie już istnieje",
        )
    unit = OrganizationalUnit(
        name=name,
        territory=payload.territory.strip(),
        competencies=payload.competencies.strip(),
    )
    session.add(unit)
    session.commit()
    session.refresh(unit)
    return unit


@router.patch("/units/{unit_id}", response_model=OrganizationalUnitPublic)
async def update_unit(
    unit_id: uuid.UUID,
    payload: OrganizationalUnitUpdate,
    _: CurrentAdminDep,
    session: SessionDep,
) -> OrganizationalUnit:
    unit = session.get(OrganizationalUnit, unit_id)
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono jednostki")

    if payload.name is not None:
        name = payload.name.strip()
        clash = session.exec(
            select(OrganizationalUnit).where(
                OrganizationalUnit.name == name,
                OrganizationalUnit.id != unit_id,
            )
        ).first()
        if clash is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Jednostka o tej nazwie już istnieje",
            )
        unit.name = name
    if payload.territory is not None:
        unit.territory = payload.territory.strip()
    if payload.competencies is not None:
        unit.competencies = payload.competencies.strip()

    session.add(unit)
    session.commit()
    session.refresh(unit)
    return unit


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit(unit_id: uuid.UUID, _: CurrentAdminDep, session: SessionDep) -> None:
    unit = session.get(OrganizationalUnit, unit_id)
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono jednostki")
    for report in session.exec(select(Report).where(Report.unit_id == unit_id)).all():
        report.unit_id = None
        session.add(report)
    for project in session.exec(select(UnitProject).where(UnitProject.unit_id == unit_id)).all():
        session.delete(project)
    for proposal in session.exec(
        select(ProjectProposal).where(ProjectProposal.suggested_unit_id == unit_id)
    ).all():
        proposal.suggested_unit_id = None
        session.add(proposal)
    session.delete(unit)
    session.commit()


@router.post(
    "/projects",
    response_model=UnitProjectPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    payload: UnitProjectCreate,
    _: CurrentAdminDep,
    session: SessionDep,
) -> UnitProjectPublic:
    unit = session.get(OrganizationalUnit, payload.unit_id)
    if unit is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wybrana jednostka nie istnieje",
        )
    project = UnitProject(
        unit_id=unit.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return _unit_project_public(session, project)


@router.patch("/projects/{project_id}", response_model=UnitProjectPublic)
async def update_project(
    project_id: uuid.UUID,
    payload: UnitProjectUpdate,
    _: CurrentAdminDep,
    session: SessionDep,
) -> UnitProjectPublic:
    project = session.get(UnitProject, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono projektu")
    if payload.unit_id is not None:
        unit = session.get(OrganizationalUnit, payload.unit_id)
        if unit is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wybrana jednostka nie istnieje",
            )
        project.unit_id = unit.id
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description.strip()
    session.add(project)
    session.commit()
    session.refresh(project)
    return _unit_project_public(session, project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID, _: CurrentAdminDep, session: SessionDep
) -> None:
    project = session.get(UnitProject, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono projektu")
    session.delete(project)
    session.commit()


@router.get("/reports", response_model=list[ReportPublic])
async def list_all_reports(_: CurrentAdminDep, session: SessionDep) -> list[ReportPublic]:
    rows = session.exec(select(Report).order_by(col(Report.created_at).desc())).all()
    return [_report_public(session, row) for row in rows]


@router.patch("/reports/{report_id}", response_model=ReportPublic)
async def update_report(
    report_id: uuid.UUID,
    payload: ReportStatusUpdate,
    _: CurrentAdminDep,
    session: SessionDep,
) -> ReportPublic:
    report = session.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono sprawy")
    if payload.status is not None:
        report.status = payload.status
    if "unit_id" in payload.model_fields_set:
        if payload.unit_id is not None:
            unit = session.get(OrganizationalUnit, payload.unit_id)
            if unit is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Wybrana jednostka nie istnieje",
                )
            report.unit_id = unit.id
        else:
            report.unit_id = None
    session.add(report)
    session.commit()
    session.refresh(report)
    return _report_public(session, report)


@router.get("/project-proposals", response_model=list[ProjectProposalPublic])
async def list_proposals(_: CurrentAdminDep, session: SessionDep) -> list[ProjectProposalPublic]:
    rows = session.exec(
        select(ProjectProposal).order_by(col(ProjectProposal.created_at).desc())
    ).all()
    return [_proposal_public(session, row) for row in rows]


@router.post(
    "/project-proposals/{proposal_id}/accept",
    response_model=UnitProjectPublic,
)
async def accept_proposal(
    proposal_id: uuid.UUID,
    payload: ProjectProposalAccept,
    _: CurrentAdminDep,
    session: SessionDep,
) -> UnitProjectPublic:
    proposal = session.get(ProjectProposal, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak propozycji")
    if proposal.status != ProjectProposalStatus.NEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propozycja już przetworzona",
        )
    unit = session.get(OrganizationalUnit, payload.unit_id)
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak jednostki")

    project = UnitProject(
        unit_id=payload.unit_id,
        name=(payload.name or proposal.name).strip(),
        description=(payload.description or proposal.description).strip(),
    )
    session.add(project)
    proposal.status = ProjectProposalStatus.ACCEPTED
    proposal.suggested_unit_id = payload.unit_id
    session.add(proposal)
    session.commit()
    session.refresh(project)
    return _unit_project_public(session, project)


@router.post(
    "/project-proposals/{proposal_id}/reject",
    response_model=ProjectProposalPublic,
)
async def reject_proposal(
    proposal_id: uuid.UUID,
    _: CurrentAdminDep,
    session: SessionDep,
) -> ProjectProposalPublic:
    proposal = session.get(ProjectProposal, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak propozycji")
    if proposal.status != ProjectProposalStatus.NEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propozycja już przetworzona",
        )
    proposal.status = ProjectProposalStatus.REJECTED
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    return _proposal_public(session, proposal)
