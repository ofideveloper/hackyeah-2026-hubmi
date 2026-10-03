"""Czat produktu — zbiera kontekst projektów i woła bypass LLM (`/llm`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.llm import get_llm_client
from app.models import Project, User
from app.schemas import ChatRequest, ChatResponse, LLMChatRequest, LLMMessage

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_INTRO = (
    "Jesteś asystentem HubMI. Pomagasz mieszkańcowi dopasować potrzebę do projektów "
    "jednostek organizacyjnych i podpowiadasz kolejne kroki. Odpowiadaj po polsku, zwięźle.\n"
    "Poniżej lista projektów w formacie PROJECT|id|unit|name|description:"
)


def _projects_system_block(projects: list[Project]) -> str:
    lines = [SYSTEM_INTRO]
    if not projects:
        lines.append("(brak projektów)")
        return "\n".join(lines)
    for project in projects:
        unit = project.unit.name if project.unit else f"jednostka #{project.unit_id}"
        # Jedna linia — parser fake LLM i przyszły real prompt
        desc = " ".join(project.description.split())
        lines.append(f"PROJECT|{project.id}|{unit}|{project.name}|{desc}")
    return "\n".join(lines)


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    projects = list(
        db.scalars(
            select(Project).options(joinedload(Project.unit)).order_by(Project.created_at.desc())
        )
        .unique()
        .all()
    )

    llm_request = LLMChatRequest(
        messages=[
            LLMMessage(role="system", content=_projects_system_block(projects)),
            LLMMessage(role="user", content=payload.message.strip()),
        ],
        model=None,
    )
    result = get_llm_client().chat(llm_request)
    return ChatResponse(reply=result.content)
