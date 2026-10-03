"""Czat produktu — historia + kontekst + karty / propozycje nowych projektów."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user_optional
from app.database import get_db
from app.llm import get_llm_client
from app.llm.client import _score_project
from app.llm.prompts import load_prompt
from app.llm.suggestions import (
    extract_location_request,
    extract_new_project_draft,
    extract_project_ids,
)
from app.models import (
    OrganizationalUnit,
    Project,
    ProjectProposal,
    ProjectProposalStatus,
    User,
)
from app.schemas import (
    ChatRequest,
    ChatResponse,
    LLMChatRequest,
    LLMMessage,
    ProjectProposalPublic,
    ProjectPublic,
)
from app.routers.project_proposals import to_public as proposal_to_public

router = APIRouter(prefix="/chat", tags=["chat"])

_MAX_HISTORY = 24


def _project_public(project: Project) -> ProjectPublic:
    return ProjectPublic(
        id=project.id,
        unit_id=project.unit_id,
        unit_name=project.unit.name if project.unit else None,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


def _build_system_context(
    units: list[OrganizationalUnit],
    projects: list[Project],
    user: User | None,
    user_message: str,
    history_blob: str = "",
) -> str:
    if user is None:
        who = "gość (niezalogowany — rozmowa z landingu)"
    else:
        who = (user.full_name or "").strip() or user.email
    match_text = f"{history_blob}\n{user_message}".strip()
    current_ok = _message_has_substance(user_message)
    history_ok = _message_has_substance(history_blob)
    allow_projects = current_ok or history_ok

    lines = [
        load_prompt("caretaker_system"),
        "",
        "---",
        f"Rozmawiasz z mieszkańcem: {who}.",
        "Poniżej historia rozmowy (jeśli jest) — używaj jej do osobistego dopasowania.",
        "",
        "Dane systemowe HubMI (źródło faktów):",
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
    project_dicts: list[dict[str, str]] = []

    # Przy samym „pomóż” NIE wstrzykuj PROJECT| — model inaczej zgaduje z listy
    if not allow_projects:
        lines.append(
            "(lista projektów ukryta — najpierw ustal konkretny temat rozmowy; "
            "nie wymyślaj żadnego projektu)"
        )
        lines.extend(
            [
                "",
                "UWAGA: brak konkretnego tematu (np. samo „pomóż”). "
                "Tylko ciepło dopytaj, o co chodzi. Zero nazw projektów, zero markerów.",
            ]
        )
        return "\n".join(lines)

    if not projects:
        lines.append("(brak projektów)")
    else:
        for project in projects:
            unit_name = project.unit.name if project.unit else f"jednostka #{project.unit_id}"
            desc = " ".join(project.description.split())
            desc_short = desc if len(desc) <= 480 else desc[:480] + "…"
            lines.append(f"PROJECT|{project.id}|{unit_name}|{project.name}|{desc_short}")
            project_dicts.append(
                {
                    "id": str(project.id),
                    "unit": unit_name,
                    "name": project.name,
                    "description": desc,
                }
            )

    if project_dicts:
        ranked = sorted(
            ((p, _score_project(match_text, p)) for p in project_dicts),
            key=lambda item: item[1],
            reverse=True,
        )
        strong = [(p, s) for p, s in ranked if s >= 55][:3]
        if strong:
            lines.extend(
                [
                    "",
                    "Kandydaci scoring — OBOWIĄZKOWO zaproponuj #1 w tej odpowiedzi z markerem:",
                ]
            )
            for project, score in strong:
                lines.append(
                    f"- id={project['id']} score={score} | {project['name']} ({project['unit']})"
                )
            top = strong[0][0]
            lines.append(
                f"NAKAZ: napisz o „{top['name']}” i dodaj [[hubmi-project:{top['id']}]]. "
                "Bez dopytywania „czy potrzebujesz pomocy”."
            )
            if not current_ok and history_ok:
                lines.append(
                    "Aktualna wiadomość jest ogólnikowa, ale historia ma temat — "
                    "nawiąż do historii; nie zgaduj nowego tematu."
                )

    return "\n".join(lines)


def _message_has_substance(text: str) -> bool:
    """Czy wiadomość ma wystarczająco treści, by w ogóle matchować projekty."""
    cleaned = " ".join(text.lower().split())
    if len(cleaned) < 12:
        return False
    vague = {
        "pomoz",
        "pomóż",
        "pomocy",
        "pomoc",
        "cześć",
        "czesc",
        "hej",
        "hello",
        "siema",
        "dzien dobry",
        "dzień dobry",
        "potrzebuje pomocy",
        "potrzebuję pomocy",
        "cos",
        "coś",
        "help",
    }
    if cleaned in vague:
        return False
    # same powitanie + proszę o pomoc bez tematu
    tokens = [t for t in cleaned.replace(",", " ").split() if len(t) >= 3]
    content_tokens = [
        t
        for t in tokens
        if t
        not in {
            "pomoz",
            "pomóż",
            "pomocy",
            "pomoc",
            "prosze",
            "proszę",
            "bardzo",
            "czesc",
            "cześć",
            "hej",
            "siema",
            "dzień",
            "dobry",
            "potrzebuje",
            "potrzebuję",
        }
    ]
    return len(content_tokens) >= 2


def _history_messages(payload: ChatRequest) -> list[LLMMessage]:
    current = payload.message.strip()
    cleaned: list[LLMMessage] = []
    for item in payload.history[-_MAX_HISTORY:]:
        text = item.content.strip()
        if not text:
            continue
        cleaned.append(LLMMessage(role=item.role, content=text))

    if cleaned and cleaned[-1].role == "user" and cleaned[-1].content == current:
        cleaned = cleaned[:-1]
    return cleaned


def _resolve_suggested(projects: list[Project], ids: list[int]) -> list[ProjectPublic]:
    by_id = {p.id: p for p in projects}
    ordered: list[ProjectPublic] = []
    seen: set[int] = set()
    for pid in ids:
        if pid in seen:
            continue
        project = by_id.get(pid)
        if project:
            seen.add(pid)
            ordered.append(_project_public(project))
        if len(ordered) >= 3:
            break
    return ordered


def _strong_project_matches(
    projects: list[Project],
    match_text: str,
) -> list[tuple[Project, int]]:
    """Projekty ze score >= 55 — te same reguły co w kontekście systemowym."""
    scored: list[tuple[Project, int]] = []
    for project in projects:
        unit_name = project.unit.name if project.unit else f"jednostka #{project.unit_id}"
        score = _score_project(
            match_text,
            {
                "id": str(project.id),
                "unit": unit_name,
                "name": project.name,
                "description": project.description,
            },
        )
        if score >= 55:
            scored.append((project, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:3]


def _ensure_project_suggestion(
    reply: str,
    ids: list[int],
    strong: list[tuple[Project, int]],
) -> tuple[str, list[int]]:
    """Gdy model tylko dopytał, a scoring ma hit — dopnij kartę projektu."""
    if not strong or ids:
        return reply, ids

    top, _score = strong[0]

    # Model wspomniał nazwę, ale zapomniał markera → wystarczy dociągnąć id (karta w UI)
    if top.name.casefold() in reply.casefold():
        return reply, [top.id]

    unit = top.unit.name if top.unit else "HubMI"
    addon = (
        f"\n\nZ tego, co mówisz, najbardziej pasuje **{top.name}** "
        f"({unit}) — warto tam zajrzeć. Poniżej krótka karta."
    )
    return reply.rstrip() + addon, [top.id]


def _persist_proposal(
    db: Session,
    user: User,
    units: list[OrganizationalUnit],
    draft_name: str,
    draft_description: str,
    suggested_unit_id: int | None,
) -> ProjectProposalPublic:
    unit_ids = {u.id for u in units}
    unit_id = suggested_unit_id if suggested_unit_id in unit_ids else None

    proposal = ProjectProposal(
        author_id=user.id,
        suggested_unit_id=unit_id,
        name=draft_name,
        description=draft_description,
        status=ProjectProposalStatus.NEW.value,
    )
    db.add(proposal)
    db.commit()
    proposal = db.scalars(
        select(ProjectProposal)
        .options(
            joinedload(ProjectProposal.author),
            joinedload(ProjectProposal.suggested_unit),
        )
        .where(ProjectProposal.id == proposal.id)
    ).first()
    assert proposal is not None
    return proposal_to_public(proposal)


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Czat opiekuna — działa dla gościa (landing) i zalogowanego mieszkańca."""
    units = list(db.scalars(select(OrganizationalUnit).order_by(OrganizationalUnit.name)).all())
    projects = list(
        db.scalars(
            select(Project).options(joinedload(Project.unit)).order_by(Project.created_at.desc())
        )
        .unique()
        .all()
    )

    history = _history_messages(payload)
    history_blob = "\n".join(m.content for m in history if m.role == "user")
    messages: list[LLMMessage] = [
        LLMMessage(
            role="system",
            content=_build_system_context(
                units,
                projects,
                user,
                payload.message.strip(),
                history_blob,
            ),
        ),
        *history,
        LLMMessage(role="user", content=payload.message.strip()),
    ]

    result = get_llm_client().chat(LLMChatRequest(messages=messages, model=None))
    reply, draft = extract_new_project_draft(result.content)
    reply, location_request = extract_location_request(reply)
    reply, ids = extract_project_ids(reply)

    match_text = f"{history_blob}\n{payload.message.strip()}".strip()
    allow_match = _message_has_substance(payload.message.strip()) or _message_has_substance(
        history_blob
    )
    strong = _strong_project_matches(projects, match_text) if allow_match else []

    # Twarda bramka: bez tematu w wiadomości ani historii — zero kart / draftu
    if not allow_match:
        ids = []
        draft = None
        location_request = None
        # Jeśli model mimo to wplótł nazwę projektu — odetnij i daj czyste dopytanie
        if any(p.name and p.name.casefold() in reply.casefold() for p in projects):
            reply = (
                "Jasne — jestem tu, żeby pomóc.\n\n"
                "Napisz proszę krótko, **czego konkretnie potrzebujesz** "
                "i **gdzie** to się dzieje. Potem dobierzemy sensowny kierunek."
            )
    elif not location_request and draft is None:
        # Model bywa „grzeczny” i tylko dopytuje — scoring dopina Himalaje itd.
        reply, ids = _ensure_project_suggestion(reply, ids, strong)

    # Nie mieszaj kart / draftu z prośbą o lokalizację w tej samej turze
    proposal_public: ProjectProposalPublic | None = None
    if location_request:
        ids = []
        draft = None
    elif draft is not None:
        ids = []
        if user is None:
            # Gość: nie zapisujemy do kolejki admina — zachęta do konta
            reply = (
                f"{reply.rstrip()}\n\n"
                "Żeby przekazać tę sprawę dalej do jednostki, **załóż konto** "
                "albo zaloguj się — wtedy zapiszę propozycję dla zespołu HubMI."
            )
        else:
            proposal_public = _persist_proposal(
                db,
                user,
                units,
                draft.name,
                draft.description,
                draft.suggested_unit_id,
            )

    suggested = _resolve_suggested(projects, ids)
    return ChatResponse(
        reply=reply,
        suggested_projects=suggested,
        project_proposal=proposal_public,
        location_request=location_request,
    )
