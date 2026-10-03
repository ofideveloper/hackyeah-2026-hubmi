"""Kolejka propozycji nowych projektów z czatu — przetwarza admin + jednostka."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_admin
from app.database import get_db
from app.models import (
    OrganizationalUnit,
    Project,
    ProjectProposal,
    ProjectProposalStatus,
    User,
)
from app.schemas import ProjectProposalAccept, ProjectProposalPublic, ProjectPublic

router = APIRouter(tags=["project-proposals"])


def to_public(proposal: ProjectProposal) -> ProjectProposalPublic:
    return ProjectProposalPublic(
        id=proposal.id,
        author_id=proposal.author_id,
        author_email=proposal.author.email if proposal.author else None,
        author_name=proposal.author.full_name if proposal.author else None,
        suggested_unit_id=proposal.suggested_unit_id,
        suggested_unit_name=proposal.suggested_unit.name if proposal.suggested_unit else None,
        name=proposal.name,
        description=proposal.description,
        status=proposal.status,
        created_at=proposal.created_at,
    )


@router.get("/admin/project-proposals", response_model=list[ProjectProposalPublic])
def list_proposals(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[ProjectProposalPublic]:
    rows = (
        db.scalars(
            select(ProjectProposal)
            .options(
                joinedload(ProjectProposal.author),
                joinedload(ProjectProposal.suggested_unit),
            )
            .order_by(ProjectProposal.created_at.desc())
        )
        .unique()
        .all()
    )
    return [to_public(row) for row in rows]


@router.post(
    "/admin/project-proposals/{proposal_id}/accept",
    response_model=ProjectPublic,
)
def accept_proposal(
    proposal_id: int,
    payload: ProjectProposalAccept,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProjectPublic:
    proposal = db.get(ProjectProposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak propozycji")
    if proposal.status != ProjectProposalStatus.NEW.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propozycja już przetworzona",
        )

    unit = db.get(OrganizationalUnit, payload.unit_id)
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak jednostki")

    project = Project(
        unit_id=payload.unit_id,
        name=(payload.name or proposal.name).strip(),
        description=(payload.description or proposal.description).strip(),
    )
    db.add(project)
    proposal.status = ProjectProposalStatus.ACCEPTED.value
    proposal.suggested_unit_id = payload.unit_id
    db.commit()
    db.refresh(project)
    project = db.scalars(
        select(Project).options(joinedload(Project.unit)).where(Project.id == project.id)
    ).first()
    assert project is not None
    return ProjectPublic(
        id=project.id,
        unit_id=project.unit_id,
        unit_name=project.unit.name if project.unit else None,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


@router.post(
    "/admin/project-proposals/{proposal_id}/reject",
    response_model=ProjectProposalPublic,
)
def reject_proposal(
    proposal_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProjectProposalPublic:
    proposal = db.get(ProjectProposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak propozycji")
    if proposal.status != ProjectProposalStatus.NEW.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propozycja już przetworzona",
        )
    proposal.status = ProjectProposalStatus.REJECTED.value
    db.commit()
    proposal = db.scalars(
        select(ProjectProposal)
        .options(
            joinedload(ProjectProposal.author),
            joinedload(ProjectProposal.suggested_unit),
        )
        .where(ProjectProposal.id == proposal_id)
    ).first()
    assert proposal is not None
    return to_public(proposal)
