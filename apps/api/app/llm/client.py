"""
Bypass LLM — jeden interfejs dla `/llm` i `/chat`.

Providery: `fake` (lokalny stub) | `gemini` (Google Generative Language API).
"""

from __future__ import annotations

import json
import logging
import re
import time
import unicodedata
import urllib.error
import urllib.request
import uuid
from abc import ABC, abstractmethod
from functools import lru_cache

logger = logging.getLogger(__name__)

from app.config import get_settings
from app.llm.suggestions import format_project_markers
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

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


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


class GeminiLLMClient(LLMClient):
    """Google Gemini — odpowiedzi na podstawie system promptu (projekty / jednostki)."""

    provider = "gemini"
    _max_attempts = 3
    _retry_statuses = {429, 503}

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key.strip()
        self.model = model.strip() or "gemini-3.8-flash"
        self._fallback = FakeLLMClient()

    def chat(self, request: LLMChatRequest) -> LLMChatResponse:
        model = (request.model or self.model).strip()
        if not self.api_key:
            return LLMChatResponse(
                id=f"gemini-missing-key-{uuid.uuid4().hex[:8]}",
                model=model,
                provider=self.provider,
                content=(
                    "Brak klucza Gemini. Ustaw `LLM_API_KEY` (Google AI Studio) "
                    "oraz `LLM_PROVIDER=gemini` w `.env`, potem zrestartuj API."
                ),
            )

        system_text = _system_content(request.messages)
        contents = _to_gemini_contents(request.messages)
        if not contents:
            contents = [{"role": "user", "parts": [{"text": "Cześć"}]}]

        body: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 1024,
            },
        }
        if system_text:
            body["system_instruction"] = {"parts": [{"text": system_text}]}

        url = f"{_GEMINI_BASE}/{model}:generateContent"
        payload = json.dumps(body).encode("utf-8")

        last_http: urllib.error.HTTPError | None = None
        for attempt in range(1, self._max_attempts + 1):
            req = urllib.request.Request(
                url,
                data=payload,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.api_key,
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                content = _extract_gemini_text(data)
                if not content:
                    content = "Gemini nie zwrócił treści — spróbuj przeformułować wiadomość."
                return LLMChatResponse(
                    id=data.get("responseId") or f"gemini-{uuid.uuid4().hex[:12]}",
                    model=model,
                    provider=self.provider,
                    content=content,
                )
            except urllib.error.HTTPError as exc:
                last_http = exc
                err_body = exc.read().decode("utf-8", errors="replace")[:400]
                if exc.code in self._retry_statuses and attempt < self._max_attempts:
                    delay = 0.8 * attempt
                    logger.warning(
                        "Gemini HTTP %s (próba %s/%s), retry za %.1fs",
                        exc.code,
                        attempt,
                        self._max_attempts,
                        delay,
                    )
                    time.sleep(delay)
                    continue
                if exc.code in self._retry_statuses:
                    logger.warning(
                        "Gemini niedostępny (%s) — fallback na fake. %s",
                        exc.code,
                        err_body,
                    )
                    fallback = self._fallback.chat(request)
                    return LLMChatResponse(
                        id=fallback.id,
                        model=fallback.model,
                        provider=f"{self.provider}+fake",
                        content=fallback.content,
                    )
                return LLMChatResponse(
                    id=f"gemini-err-{uuid.uuid4().hex[:8]}",
                    model=model,
                    provider=self.provider,
                    content=_gemini_http_message(exc.code, err_body),
                )
            except urllib.error.URLError as exc:
                return LLMChatResponse(
                    id=f"gemini-net-{uuid.uuid4().hex[:8]}",
                    model=model,
                    provider=self.provider,
                    content=(
                        "Nie udało się połączyć z Gemini (sieć). "
                        "Spróbuj za chwilę ponownie."
                    ),
                )

        # teoretycznie nieosiągalne
        code = last_http.code if last_http else 503
        return LLMChatResponse(
            id=f"gemini-err-{uuid.uuid4().hex[:8]}",
            model=model,
            provider=self.provider,
            content=_gemini_http_message(code, ""),
        )


def _gemini_http_message(code: int, err_body: str) -> str:
    if code in (429, 503):
        return (
            "Opiekun jest chwilowo przeciążony (dużo zapytań do Gemini). "
            "Spróbuj za kilka sekund ponownie."
        )
    if code in (401, 403):
        return (
            "Gemini odrzucił klucz API. Sprawdź `LLM_API_KEY` w Google AI Studio "
            "i zrestartuj API."
        )
    if code == 404:
        return (
            "Model Gemini nie istnieje lub nie jest dostępny. "
            "Ustaw `LLM_MODEL=gemini-3.8-flash` (lub inny aktualny) i zrestartuj API."
        )
    detail = f" Szczegóły: {err_body}" if err_body else ""
    return f"Gemini zwrócił błąd HTTP {code}.{detail}"


def _to_gemini_contents(messages: list[LLMMessage]) -> list[dict]:
    """Mapuje role OpenAI-like → Gemini (`user` / `model`); system idzie osobno."""
    contents: list[dict] = []
    for message in messages:
        if message.role == "system":
            continue
        role = "model" if message.role == "assistant" else "user"
        text = message.content.strip()
        if not text:
            continue
        # Gemini wymaga naprzemiennych ról — scal kolejne z tą samą rolą
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += "\n" + text
        else:
            contents.append({"role": role, "parts": [{"text": text}]})
    return contents


def _extract_gemini_text(data: dict) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")]
    return "\n".join(texts).strip()


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

    if name_norm and name_norm in user_norm:
        score += 120
    elif user_norm and len(user_norm) >= 3 and user_norm in name_norm:
        score += 100

    for word in name_norm.split():
        if len(word) < 3 or word in _STOPWORDS:
            continue
        if word in user_norm.split() or any(
            word in ut or ut in word for ut in user_norm.split() if len(ut) >= 3
        ):
            score += 45

    user_tokens = _tokens(user_text)
    desc_tokens = _tokens(desc_norm)
    unit_tokens = _tokens(unit_norm)
    score += 12 * len(user_tokens & desc_tokens)
    score += 8 * len(user_tokens & unit_tokens)

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
            "Na razie nie mam podpowiedzi z bazy — opisz sprawę dokładniej, a pomyślimy razem nad kolejnym krokiem."
        )

    ranked = sorted(
        ((p, _score_project(user_text, p)) for p in projects),
        key=lambda item: item[1],
        reverse=True,
    )
    matches = [(p, s) for p, s in ranked if s >= 40][:3]

    if matches:
        lines = [
            f"Rozumiem — chodzi o „{user_text[:220]}”.",
            "",
            "Oto co mogę Ci zaproponować:",
        ]
        for project, _score in matches:
            lines.extend(
                [
                    "",
                    f"### **{project['name']}**",
                    f"Opiekun: {project['unit']}",
                    "",
                    project["description"],
                ]
            )
        lines.extend(
            [
                "",
                "**Co dalej:** napisz, czy chcesz iść w tę stronę — albo opisz sprawę inaczej.",
                "",
                format_project_markers([int(p["id"]) for p, _ in matches]),
            ]
        )
        return "\n".join(lines)

    lines = [
        f"Jeszcze nie mam pewnego kierunku dla „{user_text[:120]}”.",
        "",
        "Możemy rozważyć m.in.:",
        "",
    ]
    preview = projects[:3]
    for project in preview:
        lines.append(f"- **{project['name']}** — {project['unit']}")
    lines.extend(
        [
            "",
            "Opisz sytuację własnymi słowami — razem pomyślimy nad rozwiązaniem.",
            "",
            format_project_markers([int(p["id"]) for p in preview if p.get("id")]),
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
    if provider == "gemini":
        return GeminiLLMClient(
            api_key=settings.llm_api_key,
            model=settings.llm_model,
        )
    return FakeLLMClient()
