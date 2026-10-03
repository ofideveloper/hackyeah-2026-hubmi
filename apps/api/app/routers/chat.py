"""Czat produktu — kontekst jednostek/projektów + sugestie kart do UI."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.llm import get_llm_client
from app.llm.prompts import load_prompt
from app.llm.suggestions import extract_project_ids
from app.models import OrganizationalUnit, Project, User
from app.schemas import ChatRequest, ChatResponse, LLMChatRequest, LLMMessage, ProjectPublic

router = APIRouter(prefix="/chat", tags=["chat"])


def _project_public(project: Project) -> ProjectPublic:
    return ProjectPublic(
        id=project.id,
        unit_id=project.unit_id,
        unit_name=project.unit.name if project.unit else None,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


def _build_system_context(units: list[OrganizationalUnit], projects: list[Project]) -> str:
    lines = [
        load_prompt("caretaker_system"),
        "",
        "---",
        "Dane systemowe (źródło faktów):",
        "",
        "Jednostki:",
    ]
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


def _resolve_suggested(
    projects: list[Project],
    ids: list[int],
    reply_text: str,
) -> list[ProjectPublic]:
    by_id = {p.id: p for p in projects}
    ordered: list[Project] = []
    for pid in ids:
        project = by_id.get(pid)
        if project:
            ordered.append(project)

    # Fallback: nazwa projektu wspomniana w tekście (gdy model zapomni markera)
    if not ordered:
        reply_lower = reply_text.casefold()
        for project in projects:
            if project.name and project.name.casefold() in reply_lower:
                ordered.append(project)
            if len(ordered) >= 3:
                break

    return [_project_public(p) for p in ordered[:3]]


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
    reply, ids = extract_project_ids(result.content)
    suggested = _resolve_suggested(projects, ids, reply)
    return ChatResponse(reply=reply, suggested_projects=suggested)
