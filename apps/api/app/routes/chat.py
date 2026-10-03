"""Czat opiekuna — kontekst UNIT|/PROJECT|, scoring, karty i propozycje."""

from __future__ import annotations

import json
import time
import uuid

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, col, select

from ..config import get_settings
from ..dependencies.auth import OptionalUserDep
from ..dependencies.db import SessionDep
from ..llm.client import _score_project
from ..llm.prompts import load_prompt
from ..llm.suggestions import (
    extract_location_request,
    extract_new_project_draft,
    extract_project_ids,
)
from ..models import (
    ChatHistory,
    OrganizationalUnit,
    ProjectProposal,
    ProjectProposalPublic,
    ProjectProposalStatus,
    UnitProject,
    UnitProjectPublic,
    User,
)

router = APIRouter(prefix="/chat", tags=["chat"])

_MAX_HISTORY = 24


class LLMError(Exception):
    pass


def _llm_config() -> tuple[str, str, str]:
    """Zwraca (base_url, api_key, model) z settings — nie cache'uj przy imporcie modułu."""
    settings = get_settings()
    key = (settings.llm_api_key or "").strip()
    model = (settings.llm_model or "gpt-4o-mini").strip()
    explicit = getattr(settings, "llm_base_url", "") or ""
    if explicit:
        base = explicit.rstrip("/")
    elif settings.llm_provider == "openai":
        base = "https://api.openai.com/v1"
    else:
        base = "https://openrouter.ai/api/v1"
    return base, key, model


async def ask_llm(messages: list[dict[str, str]]) -> str:
    base, api_key, model = _llm_config()
    if not api_key:
        raise LLMError("brak LLM_API_KEY w konfiguracji")

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": messages},
            )
    except httpx.HTTPError as exc:
        raise LLMError(f"brak połączenia z {base} ({type(exc).__name__})") from exc

    try:
        data = response.json()
    except ValueError:
        data = {}
    error = data.get("error") if isinstance(data, dict) else None
    if response.is_error or error:
        detail = error.get("message") if isinstance(error, dict) else error
        raise LLMError(str(detail or f"HTTP {response.status_code}"))
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMError("nieoczekiwany format odpowiedzi") from exc


class ChatHistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    chat_id: uuid.UUID | None = None
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=40)


class ChatReply(BaseModel):
    reply: str
    chat_id: uuid.UUID
    suggested_projects: list[UnitProjectPublic] = Field(default_factory=list)
    project_proposal: ProjectProposalPublic | None = None
    location_request: str | None = Field(default=None, pattern="^(area|gps)$")


def _unit_name(units_by_id: dict[uuid.UUID, OrganizationalUnit], unit_id: uuid.UUID) -> str:
    unit = units_by_id.get(unit_id)
    return unit.name if unit else f"jednostka {unit_id}"


def _project_public(
    project: UnitProject, units_by_id: dict[uuid.UUID, OrganizationalUnit]
) -> UnitProjectPublic:
    return UnitProjectPublic(
        id=project.id,
        unit_id=project.unit_id,
        unit_name=_unit_name(units_by_id, project.unit_id),
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


def _proposal_public(
    session: Session,
    proposal: ProjectProposal,
    units_by_id: dict[uuid.UUID, OrganizationalUnit],
) -> ProjectProposalPublic:
    author = session.get(User, proposal.author_id)
    unit = (
        units_by_id.get(proposal.suggested_unit_id)
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


def _message_has_substance(text: str) -> bool:
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


def _build_system_context(
    units: list[OrganizationalUnit],
    projects: list[UnitProject],
    units_by_id: dict[uuid.UUID, OrganizationalUnit],
    user: User | None,
    user_message: str,
    history_blob: str = "",
) -> str:
    if user is None:
        who = "gość (niezalogowany — rozmowa z landingu)"
    else:
        who = f"{user.name} {user.surname}".strip() or user.email

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
        "Dane systemowe MaloHUB (źródło faktów):",
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
            unit_name = _unit_name(units_by_id, project.unit_id)
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


def _history_messages(payload: ChatRequest) -> list[dict[str, str]]:
    current = payload.message.strip()
    cleaned: list[dict[str, str]] = []
    for item in payload.history[-_MAX_HISTORY:]:
        text = item.content.strip()
        if not text:
            continue
        cleaned.append({"role": item.role, "content": text})

    if cleaned and cleaned[-1]["role"] == "user" and cleaned[-1]["content"] == current:
        cleaned = cleaned[:-1]
    return cleaned


def _strong_project_matches(
    projects: list[UnitProject],
    units_by_id: dict[uuid.UUID, OrganizationalUnit],
    match_text: str,
) -> list[tuple[UnitProject, int]]:
    scored: list[tuple[UnitProject, int]] = []
    for project in projects:
        unit_name = _unit_name(units_by_id, project.unit_id)
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
    ids: list[str],
    strong: list[tuple[UnitProject, int]],
    units_by_id: dict[uuid.UUID, OrganizationalUnit],
) -> tuple[str, list[str]]:
    if not strong or ids:
        return reply, ids

    top, _score = strong[0]
    top_id = str(top.id)

    if top.name.casefold() in reply.casefold():
        return reply, [top_id]

    unit = _unit_name(units_by_id, top.unit_id)
    addon = (
        f"\n\nZ tego, co mówisz, najbardziej pasuje **{top.name}** "
        f"({unit}) — warto tam zajrzeć. Poniżej krótka karta."
    )
    return reply.rstrip() + addon, [top_id]


def _resolve_suggested(
    projects: list[UnitProject],
    units_by_id: dict[uuid.UUID, OrganizationalUnit],
    ids: list[str],
) -> list[UnitProjectPublic]:
    by_id = {str(p.id): p for p in projects}
    ordered: list[UnitProjectPublic] = []
    seen: set[str] = set()
    for pid in ids:
        if pid in seen:
            continue
        project = by_id.get(pid)
        if project:
            seen.add(pid)
            ordered.append(_project_public(project, units_by_id))
        if len(ordered) >= 3:
            break
    return ordered


def _persist_proposal(
    session: Session,
    user: User,
    units_by_id: dict[uuid.UUID, OrganizationalUnit],
    draft_name: str,
    draft_description: str,
    suggested_unit_id: uuid.UUID | None,
) -> ProjectProposalPublic:
    unit_id = suggested_unit_id if suggested_unit_id in units_by_id else None
    proposal = ProjectProposal(
        author_id=user.id,
        suggested_unit_id=unit_id,
        name=draft_name,
        description=draft_description,
        status=ProjectProposalStatus.NEW,
    )
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    return _proposal_public(session, proposal, units_by_id)


def _persist_chat(
    session: Session,
    chat: ChatHistory | None,
    message: str,
    reply: str,
    prior_turns: list[dict[str, str]],
) -> ChatHistory:
    turns = list(prior_turns)
    turns.append({"role": "user", "text": message})
    turns.append({"role": "assistant", "text": reply})
    if chat is None:
        chat = ChatHistory(first_question=message, all_conversation="")
    chat.all_conversation = json.dumps(turns, ensure_ascii=False)
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


async def _chat_handler(
    payload: ChatRequest,
    session: SessionDep,
    user: OptionalUserDep,
) -> ChatReply:
    start = time.time()

    chat: ChatHistory | None = None
    if payload.chat_id is not None:
        chat = session.get(ChatHistory, payload.chat_id)
        if chat is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rozmowa nie istnieje",
            )

    units = list(
        session.exec(select(OrganizationalUnit).order_by(col(OrganizationalUnit.name))).all()
    )
    units_by_id = {u.id: u for u in units}
    projects = list(
        session.exec(select(UnitProject).order_by(col(UnitProject.created_at).desc())).all()
    )

    history = _history_messages(payload)
    # Fallback: jeśli front nie przysłał historii, weź z DB (chat_id)
    if not history and chat is not None and chat.all_conversation:
        try:
            stored = json.loads(chat.all_conversation)
            history = [
                {"role": t["role"], "content": t["text"]}
                for t in stored
                if t.get("role") in {"user", "assistant"} and t.get("text")
            ][-_MAX_HISTORY:]
        except (json.JSONDecodeError, TypeError, KeyError):
            history = []

    history_blob = "\n".join(m["content"] for m in history if m["role"] == "user")
    user_message = payload.message.strip()

    system = _build_system_context(
        units, projects, units_by_id, user, user_message, history_blob
    )
    messages = (
        [{"role": "system", "content": system}]
        + history
        + [{"role": "user", "content": user_message}]
    )

    try:
        raw_reply = await ask_llm(messages)
        print(f"Chat response time: {time.time() - start:.2f} seconds")
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Model nie odpowiedział: {exc}",
        ) from exc

    reply, draft = extract_new_project_draft(raw_reply)
    reply, location_request = extract_location_request(reply)
    reply, ids = extract_project_ids(reply)

    match_text = f"{history_blob}\n{user_message}".strip()
    allow_match = _message_has_substance(user_message) or _message_has_substance(history_blob)
    strong = (
        _strong_project_matches(projects, units_by_id, match_text) if allow_match else []
    )

    if not allow_match:
        ids = []
        draft = None
        location_request = None
        if any(p.name and p.name.casefold() in reply.casefold() for p in projects):
            reply = (
                "Jasne — jestem tu, żeby pomóc.\n\n"
                "Napisz proszę krótko, **czego konkretnie potrzebujesz** "
                "i **gdzie** to się dzieje. Potem dobierzemy sensowny kierunek."
            )
    elif not location_request and draft is None:
        reply, ids = _ensure_project_suggestion(reply, ids, strong, units_by_id)

    proposal_public: ProjectProposalPublic | None = None
    if location_request:
        ids = []
        draft = None
    elif draft is not None:
        ids = []
        if user is None:
            reply = (
                f"{reply.rstrip()}\n\n"
                "Żeby przekazać tę sprawę dalej do jednostki, **załóż konto** "
                "albo zaloguj się — wtedy zapiszę propozycję dla zespołu MaloHUB."
            )
        else:
            proposal_public = _persist_proposal(
                session,
                user,
                units_by_id,
                draft.name,
                draft.description,
                draft.suggested_unit_id,
            )

    suggested = _resolve_suggested(projects, units_by_id, ids)

    # Historia w DB: bez surowych markerów (już wyczyszczone w reply)
    prior_for_db: list[dict[str, str]] = []
    if chat is not None and chat.all_conversation:
        try:
            prior_for_db = [
                {"role": t["role"], "text": t["text"]}
                for t in json.loads(chat.all_conversation)
                if t.get("role") in {"user", "assistant"} and t.get("text")
            ]
        except (json.JSONDecodeError, TypeError, KeyError):
            prior_for_db = []
    elif history:
        prior_for_db = [{"role": m["role"], "text": m["content"]} for m in history]

    chat = _persist_chat(session, chat, user_message, reply, prior_for_db)

    return ChatReply(
        reply=reply,
        chat_id=chat.id,
        suggested_projects=suggested,
        project_proposal=proposal_public,
        location_request=location_request,
    )


# Obie ścieżki — bez 307, które psuje BFF (POST + redirect).
router.add_api_route("", _chat_handler, methods=["POST"], response_model=ChatReply)
router.add_api_route("/", _chat_handler, methods=["POST"], response_model=ChatReply)
