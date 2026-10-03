"""
Bypass LLM — jeden interfejs, na razie provider `fake`.

Później podmień FakeLLMClient na prawdziwy HTTP do OpenAI/Azure/itp.
bez zmiany routerów `/llm` i `/chat`.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from abc import ABC, abstractmethod
from functools import lru_cache

from app.config import get_settings
from app.schemas import LLMChatRequest, LLMChatResponse, LLMMessage

_STOPWORDS = {
    "a",
    "i",
    "o",
    "w",
    "z",
    "na",
    "do",
    "sie",
    "jest",
    "nie",
    "to",
    "jak",
    "czy",
    "mam",
    "chce",
    "prosze",
    "moze",
    "pomoc",
    "pomocy",
    "jestem",
    "projekt",
    "projekty",
    "o",
}


class LLMClient(ABC):
    provider: str

    @abstractmethod
    def chat(self, request: LLMChatRequest) -> LLMChatResponse:
        raise NotImplementedError


class FakeLLMClient(LLMClient):
    """Lokalny bypass — nie woła zewnętrznego modelu."""

    provider = "fake"

    def chat(self, request: LLMChatRequest) -> LLMChatResponse:
        model = request.model or "hubmi-fake-v1"
        user_text = _last_user_content(request.messages)
        system_text = _system_content(request.messages)
        content = _fake_complete(user_text, system_text)

        return LLMChatResponse(
            id=f"fake-{uuid.uuid4().hex[:12]}",
            model=model,
            provider=self.provider,
            content=content,
        )


class HttpLLMClient(LLMClient):
    """
    Placeholder pod prawdziwy LLM.

    Gdy `LLM_PROVIDER=http` i ustawisz `LLM_BASE_URL`, tu pójdzie HTTP.
    Na razie zwraca komunikat o braku konfiguracji — bez crasha.
    """

    provider = "http"

    def __init__(self, base_url: str, api_key: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def chat(self, request: LLMChatRequest) -> LLMChatResponse:
        return LLMChatResponse(
            id=f"http-stub-{uuid.uuid4().hex[:12]}",
            model=request.model or "unset",
            provider=self.provider,
            content=(
                "[LLM http stub] Ustaw prawdziwy klient w `app/llm/client.py` "
                f"(LLM_BASE_URL={self.base_url}). Na razie działa provider `fake`."
            ),
        )


def _last_user_content(messages: list[LLMMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user" and message.content.strip():
            return message.content.strip()
    return ""


def _system_content(messages: list[LLMMessage]) -> str:
    parts = [m.content for m in messages if m.role == "system"]
    return "\n".join(parts)


def _strip_diacritics(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _normalize(text: str) -> str:
    text = _strip_diacritics(text.lower())
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text: str) -> set[str]:
    return {w for w in _normalize(text).split() if len(w) >= 3 and w not in _STOPWORDS}


def _score_project(user_text: str, project: dict[str, str]) -> int:
    """Wyższy wynik = lepsze trafienie; nazwa projektu ma priorytet (słowa kluczowe)."""
    user_norm = _normalize(user_text)
    name_norm = _normalize(project["name"])
    desc_norm = _normalize(project["description"])
    unit_norm = _normalize(project["unit"])
    if not user_norm:
        return 0

    score = 0

    # Pełna nazwa / fragment nazwy w wiadomości użytkownika
    if name_norm and name_norm in user_norm:
        score += 120
    elif user_norm and len(user_norm) >= 3 and user_norm in name_norm:
        score += 100

    # Poszczególne słowa z nazwy projektu (np. „chodników”, „remont”)
    for word in name_norm.split():
        if len(word) < 3 or word in _STOPWORDS:
            continue
        if word in user_norm.split() or any(
            word in ut or ut in word for ut in user_norm.split() if len(ut) >= 3
        ):
            score += 45

    # Opis / jednostka — słabsze sygnały
    user_tokens = _tokens(user_text)
    desc_tokens = _tokens(desc_norm)
    unit_tokens = _tokens(unit_norm)
    score += 12 * len(user_tokens & desc_tokens)
    score += 8 * len(user_tokens & unit_tokens)

    # Prefiksowe dopasowanie PL (chodnik/chodniku/chodników)
    for ut in user_tokens:
        for pt in _tokens(f"{name_norm} {desc_norm}"):
            if len(ut) >= 4 and len(pt) >= 4 and (ut.startswith(pt[:4]) or pt.startswith(ut[:4])):
                score += 6

    return score


def _fake_complete(user_text: str, system_text: str) -> str:
    """Odpowiedź z informacją zwrotną o dopasowanych projektach (słowa kluczowe / nazwa)."""
    if not user_text:
        return (
            "Napisz słowo kluczowe lub nazwę projektu — dam Ci informację zwrotną: "
            "opis, jednostkę odpowiedzialną i kolejny krok."
        )

    projects = _parse_projects_from_system(system_text)
    if not projects:
        return (
            f"Rozumiem: „{user_text[:200]}”. "
            "Nie mam jeszcze projektów w bazie. Poproś admina o dodanie projektu do jednostki "
            "albo złóż zgłoszenie w formularzu poniżej."
        )

    ranked = sorted(
        ((p, _score_project(user_text, p)) for p in projects),
        key=lambda item: item[1],
        reverse=True,
    )
    matches = [(p, s) for p, s in ranked if s >= 40][:3]

    if matches:
        lines = [
            f"Znalazłem trafienie dla: „{user_text[:220]}”.",
            "",
            "Informacja zwrotna:",
        ]
        for project, score in matches:
            lines.extend(
                [
                    "",
                    f"**{project['name']}**",
                    f"• Jednostka: {project['unit']}",
                    f"• Opis: {project['description']}",
                    f"• Trafność: {score}",
                ]
            )
        lines.extend(
            [
                "",
                "Kolejny krok: jeśli to ta sprawa — złóż zgłoszenie do tej jednostki poniżej "
                "albo doprecyzuj, czego dokładnie potrzebujesz.",
            ]
        )
        return "\n".join(lines)

    lines = [
        f"Nie znalazłem projektu po słowie kluczowym „{user_text[:120]}”.",
        "",
        "Dostępne projekty (wpisz fragment nazwy, np. pierwsze słowo):",
    ]
    for project in projects[:8]:
        lines.append(f"• **{project['name']}** — {project['unit']}")
    lines.extend(
        [
            "",
            "Możesz też opisać potrzebę własnymi słowami albo od razu utworzyć zgłoszenie.",
        ]
    )
    return "\n".join(lines)


def _parse_projects_from_system(system_text: str) -> list[dict[str, str]]:
    """
    Oczekiwany format linii w system prompt:
    - PROJECT|id|unit|name|description
    """
    projects: list[dict[str, str]] = []
    for line in system_text.splitlines():
        if not line.startswith("PROJECT|"):
            continue
        parts = line.split("|", 4)
        if len(parts) != 5:
            continue
        _, _id, unit, name, description = parts
        projects.append(
            {
                "id": _id.strip(),
                "unit": unit.strip(),
                "name": name.strip(),
                "description": description.strip(),
            }
        )
    return projects


@lru_cache
def get_llm_client() -> LLMClient:
    settings = get_settings()
    provider = settings.llm_provider.lower().strip()
    if provider == "http":
        return HttpLLMClient(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key or None,
        )
    return FakeLLMClient()
