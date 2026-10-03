"""Czat produktu — zbiera kontekst jednostek/projektów i woła LLM (`/llm`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.llm import get_llm_client
from app.models import OrganizationalUnit, Project, User
from app.schemas import ChatRequest, ChatResponse, LLMChatRequest, LLMMessage

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_INTRO = """Jesteś społecznym opiekunem HubMI. Rozmawiasz z mieszkańcem po polsku — ciepło, zwięźle, bez żargonu technicznego.

Korzystaj WYŁĄCZNIE z listy jednostek i projektów poniżej (dodatkowe informacje z systemu). Nie wymyślaj jednostek ani projektów spoza listy.
Dopasuj potrzebę mieszkańca do najlepszego projektu / jednostki, wyjaśnij dlaczego i zaproponuj prosty kolejny krok.
Jeśli nic nie pasuje — dopytaj o lokalizację i rodzaj sprawy, albo wskaż najbliższe opcje z listy.
Format linii PROJECT|id|jednostka|nazwa|opis zachowaj jako źródło faktów (nie cytuj go dosłownie użytkownikowi).

Dane systemowe:"""


def _build_system_context(units: list[OrganizationalUnit], projects: list[Project]) -> str:
    lines = [SYSTEM_INTRO, "", "Jednostki:"]
    if not units:
        lines.append("(brak jednostek)")
    else:
        for unit in units:
            territory = " ".join(unit.territory.split())
            competencies = " ".join(unit.competencies.split())
            lines.append(
                f"UNIT|{unit.id}|{unit.name}|teren: {territory}|kompetencje: {competencies}"
            )

    lines.extend(["", "Projekty:"])
    if not projects:
        lines.append("(brak projektów)")
    else:
        for project in projects:
            unit_name = project.unit.name if project.unit else f"jednostka #{project.unit_id}"
            desc = " ".join(project.description.split())
            lines.append(f"PROJECT|{project.id}|{unit_name}|{project.name}|{desc}")

    return "\n".join(lines)


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    units = list(db.scalars(select(OrganizationalUnit).order_by(OrganizationalUnit.name)).all())
    projects = list(
        db.scalars(
            select(Project).options(joinedload(Project.unit)).order_by(Project.created_at.desc())
        )
        .unique()
        .all()
    )

    llm_request = LLMChatRequest(
        messages=[
            LLMMessage(role="system", content=_build_system_context(units, projects)),
            LLMMessage(role="user", content=payload.message.strip()),
        ],
        model=None,
    )
    result = get_llm_client().chat(llm_request)
    return ChatResponse(reply=result.content)
