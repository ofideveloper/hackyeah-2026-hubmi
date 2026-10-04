import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import col, func, or_, select

from ..dependencies.auth import CurrentAdminDep
from ..dependencies.db import SessionDep
from ..dependencies.logger import get_logger
from ..models import (
    AdminStats,
    Conversation,
    ConversationKind,
    ConversationStatus,
    ProjectProposal,
    ProjectProposalPublic,
    ProjectProposalStatus,
    ProposalOfNewProject,
    RoleEnum,
    StatusEnum,
    TesterSignup,
    User,
    UserPublic,
)

router = APIRouter(prefix="/admin", tags=["admin"])
logger = get_logger(__name__)


def _proposal_public(
    session: SessionDep, proposal: ProjectProposal
) -> ProjectProposalPublic:
    author = session.get(User, proposal.author_id)
    author_name = None
    if author is not None:
        author_name = f"{author.name} {author.surname}".strip() or None
    return ProjectProposalPublic(
        id=proposal.id,
        author_id=proposal.author_id,
        author_email=author.email if author else None,
        author_name=author_name,
        name=proposal.name,
        description=proposal.description,
        status=proposal.status,
        created_at=proposal.created_at,
    )


@router.get("/stats", response_model=AdminStats)
async def stats(_: CurrentAdminDep, session: SessionDep) -> AdminStats:
    users_total = session.exec(select(func.count()).select_from(User)).one()
    admins_total = session.exec(
        select(func.count()).select_from(User).where(User.role == RoleEnum.ADMIN)
    ).one()
    return AdminStats(
        users_total=users_total or 0,
        users_active=users_total or 0,
        admins_total=admins_total or 0,
    )


class AdminInbox(BaseModel):
    """Co czeka na decyzję zespołu — liczniki w nawigacji panelu."""

    ideas: int
    tester_signups: int
    proposals: int
    messages: int


@router.get("/inbox", response_model=AdminInbox)
async def inbox(_: CurrentAdminDep, session: SessionDep) -> AdminInbox:
    def count(model, *where) -> int:
        return (
            session.exec(select(func.count()).select_from(model).where(*where)).one()
            or 0
        )

    return AdminInbox(
        ideas=count(
            ProposalOfNewProject, ProposalOfNewProject.status == StatusEnum.PENDING
        ),
        tester_signups=count(TesterSignup, TesterSignup.status == StatusEnum.PENDING),
        proposals=count(
            ProjectProposal, ProjectProposal.status == ProjectProposalStatus.NEW
        ),
        messages=count(
            Conversation,
            Conversation.kind == ConversationKind.QUESTION,
            Conversation.status == ConversationStatus.OPEN,
            Conversation.last_author_id == Conversation.author_id,
            or_(
                col(Conversation.recipient_read_at).is_(None),
                Conversation.last_message_at > Conversation.recipient_read_at,  # type: ignore
            ),
        ),
    )


@router.get("/users", response_model=list[UserPublic])
async def list_users(_: CurrentAdminDep, session: SessionDep) -> list[User]:
    return list(session.exec(select(User).order_by(col(User.email))).all())


class UserRoleUpdate(BaseModel):
    # rola admina nie jest nadawana z panelu — tylko seed
    role: Literal["user", "specialist"]


@router.patch("/users/{user_id}", response_model=UserPublic)
async def set_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    admin: CurrentAdminDep,
    session: SessionDep,
) -> User:
    """Nadanie lub odebranie roli mentora (`specialist`)."""
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Brak użytkownika"
        )
    if user.role == RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można zmienić roli administratora",
        )
    user.role = RoleEnum(payload.role)
    session.add(user)
    session.commit()
    session.refresh(user)
    logger.info(
        "Admin %s ustawił rolę %s użytkownikowi %s", admin.id, user.role.value, user.id
    )
    return user


@router.get("/project-proposals", response_model=list[ProjectProposalPublic])
async def list_proposals(
    _: CurrentAdminDep, session: SessionDep
) -> list[ProjectProposalPublic]:
    rows = session.exec(
        select(ProjectProposal).order_by(col(ProjectProposal.created_at).desc())
    ).all()
    return [_proposal_public(session, row) for row in rows]


@router.post(
    "/project-proposals/{proposal_id}/accept",
    response_model=ProjectProposalPublic,
)
async def accept_proposal(
    proposal_id: uuid.UUID,
    admin: CurrentAdminDep,
    session: SessionDep,
) -> ProjectProposalPublic:
    proposal = session.get(ProjectProposal, proposal_id)
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Brak propozycji"
        )
    if proposal.status != ProjectProposalStatus.NEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propozycja już przetworzona",
        )
    proposal.status = ProjectProposalStatus.ACCEPTED
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    logger.info("Admin %s zaakceptował propozycję %s", admin.id, proposal_id)
    return _proposal_public(session, proposal)


@router.post(
    "/project-proposals/{proposal_id}/reject",
    response_model=ProjectProposalPublic,
)
async def reject_proposal(
    proposal_id: uuid.UUID,
    admin: CurrentAdminDep,
    session: SessionDep,
) -> ProjectProposalPublic:
    proposal = session.get(ProjectProposal, proposal_id)
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Brak propozycji"
        )
    if proposal.status != ProjectProposalStatus.NEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propozycja już przetworzona",
        )
    proposal.status = ProjectProposalStatus.REJECTED
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    logger.info("Admin %s odrzucił propozycję %s", admin.id, proposal_id)
    return _proposal_public(session, proposal)
