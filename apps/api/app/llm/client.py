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
_OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


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
        history_text = _conversation_blob(request.messages)
        content = _fake_complete(user_text, system_text, history_text)

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


class OpenAILLMClient(LLMClient):
    """OpenAI Chat Completions — system prompt + historia rozmowy."""

    provider = "openai"
    _max_attempts = 3
    _retry_statuses = {429, 503}

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key.strip()
        self.model = model.strip() or "gpt-4o-mini"
        self._fallback = FakeLLMClient()

    def chat(self, request: LLMChatRequest) -> LLMChatResponse:
        model = (request.model or self.model).strip()
        if not self.api_key:
            return LLMChatResponse(
                id=f"openai-missing-key-{uuid.uuid4().hex[:8]}",
                model=model,
                provider=self.provider,
                content=(
                    "Brak klucza OpenAI. Ustaw `LLM_API_KEY` oraz `LLM_PROVIDER=openai` "
                    "w `.env`, potem zrestartuj API."
                ),
            )

        messages = [
            {"role": m.role, "content": m.content.strip()}
            for m in request.messages
            if m.content.strip()
        ]
        if not messages:
            messages = [{"role": "user", "content": "Cześć"}]

        body = {
            "model": model,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 1024,
        }
        payload = json.dumps(body).encode("utf-8")

        last_http: urllib.error.HTTPError | None = None
        for attempt in range(1, self._max_attempts + 1):
            req = urllib.request.Request(
                _OPENAI_CHAT_URL,
                data=payload,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                content = _extract_openai_text(data)
                if not content:
                    content = "OpenAI nie zwrócił treści — spróbuj przeformułować wiadomość."
                return LLMChatResponse(
                    id=data.get("id") or f"openai-{uuid.uuid4().hex[:12]}",
                    model=data.get("model") or model,
                    provider=self.provider,
                    content=content,
                )
            except urllib.error.HTTPError as exc:
                last_http = exc
                err_body = exc.read().decode("utf-8", errors="replace")[:400]
                # Brak środków / quota — nie retry i nie udawaj „przeciążenia”
                if "insufficient_quota" in err_body or "credit_balance" in err_body:
                    return LLMChatResponse(
                        id=f"openai-quota-{uuid.uuid4().hex[:8]}",
                        model=model,
                        provider=self.provider,
                        content=(
                            "Konto OpenAI nie ma środków (brak kredytów). "
                            "Doładuj billing na platform.openai.com, potem spróbuj ponownie."
                        ),
                    )
                if exc.code in self._retry_statuses and attempt < self._max_attempts:
                    delay = 0.8 * attempt
                    logger.warning(
                        "OpenAI HTTP %s (próba %s/%s), retry za %.1fs",
                        exc.code,
                        attempt,
                        self._max_attempts,
                        delay,
                    )
                    time.sleep(delay)
                    continue
                if exc.code in self._retry_statuses:
                    logger.warning(
                        "OpenAI niedostępny (%s) — fallback na fake. %s",
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
                    id=f"openai-err-{uuid.uuid4().hex[:8]}",
                    model=model,
                    provider=self.provider,
                    content=_openai_http_message(exc.code, err_body),
                )
            except urllib.error.URLError:
                return LLMChatResponse(
                    id=f"openai-net-{uuid.uuid4().hex[:8]}",
                    model=model,
                    provider=self.provider,
                    content=(
                        "Nie udało się połączyć z OpenAI (sieć). "
                        "Spróbuj za chwilę ponownie."
                    ),
                )

        code = last_http.code if last_http else 503
        return LLMChatResponse(
            id=f"openai-err-{uuid.uuid4().hex[:8]}",
            model=model,
            provider=self.provider,
            content=_openai_http_message(code, ""),
        )


def _extract_openai_text(data: dict) -> str:
    choices = data.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    return ""


def _openai_http_message(code: int, err_body: str) -> str:
    if code in (429, 503):
        return (
            "Opiekun jest chwilowo przeciążony (OpenAI). "
            "Spróbuj za kilka sekund ponownie."
        )
    if code in (401, 403):
        return (
            "OpenAI odrzucił klucz API. Sprawdź `LLM_API_KEY` na platform.openai.com "
            "i zrestartuj API."
        )
    if code == 404:
        return (
            "Model OpenAI nie istnieje lub nie jest dostępny. "
            "Ustaw np. `LLM_MODEL=gpt-4o-mini` i zrestartuj API."
        )
    detail = f" Szczegóły: {err_body}" if err_body else ""
    return f"OpenAI zwrócił błąd HTTP {code}.{detail}"


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
    # ł/Ł nie rozkładają się w NFD — mapuj ręcznie
    text = text.replace("ł", "l").replace("Ł", "L")
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

    # Charakterystyczne słowa z nazwy (np. „autyzmu” ↔ „autyzm”)
    for word in name_norm.split():
        if len(word) < 4 or word in _STOPWORDS:
            continue
        stem = word[: max(4, len(word) - 1)]
        if stem in user_norm or word in user_norm:
            score += 70
        elif any(
            len(ut) >= 4 and (ut.startswith(stem[:4]) or stem.startswith(ut[:4]))
            for ut in user_norm.split()
        ):
            score += 55

    user_tokens = _tokens(user_text)
    desc_tokens = _tokens(desc_norm)
    unit_tokens = _tokens(unit_norm)
    score += 12 * len(user_tokens & desc_tokens)
    score += 8 * len(user_tokens & unit_tokens)

    # Silne słowa z opisu (autyzm, spektrum, …) — nie tylko dokładny token
    for pt in desc_tokens:
        if len(pt) < 5:
            continue
        if pt in user_norm or any(
            len(ut) >= 4 and (ut.startswith(pt[:5]) or pt.startswith(ut[:5]))
            for ut in user_tokens
        ):
            score += 18

    for ut in user_tokens:
        for pt in _tokens(f"{name_norm} {desc_norm}"):
            if len(ut) >= 4 and len(pt) >= 4 and (ut.startswith(pt[:4]) or pt.startswith(ut[:4])):
                score += 6

    return score


def _conversation_blob(messages: list[LLMMessage]) -> str:
    parts = [
        m.content.strip()
        for m in messages
        if m.role in {"user", "assistant"} and m.content.strip()
    ]
    return "\n".join(parts)


def _has_location_cue(text: str) -> bool:
    """Czy w tekście jest już miasto / dzielnica / ulica / GPS."""
    norm = _normalize(text)
    if not norm:
        return False
    if re.search(r"-?\d{1,3}\.\d{3,}.+-?\d{1,3}\.\d{3,}", text):
        return True
    place_hints = (
        "krakow",
        "warszawa",
        "wroclaw",
        "poznan",
        "gdansk",
        "lodz",
        "zablocie",
        "mokotow",
        "praga",
        "ul ",
        "ulica",
        "osiedle",
        "dzielnic",
        "maps.google",
    )
    return any(hint in norm for hint in place_hints)


def _topic_flags(text: str) -> set[str]:
    norm = _normalize(text)
    flags: set[str] = set()
    housing = ("mieszk", "nocleg", "schronisk", "bezdom", "dachu nad", "wynajem", "lokum")
    if any(k in norm for k in housing):
        flags.add("housing")
    if any(k in norm for k in ("dziur", "jezdn", "chodnik", "asfalt", "drog")):
        flags.add("road")
    if any(k in norm for k in ("zagro", "boje sie", "przemoc", "napad", "112")):
        flags.add("safety")
    return flags


def _extract_facts(text: str) -> dict[str, object]:
    """Fakty już powiedziane w rozmowie — żeby nie dopytywać drugi raz."""
    norm = _normalize(text)
    duration: str | None = None
    if any(k in norm for k in ("na dluzej", "dlugotermin", "stale", "na stale", "dlugotrwal")):
        duration = "long"
    elif any(k in norm for k in ("na juz", "nocleg", "dziś", "dzis", "natychmiast", "awaryjn")):
        duration = "short"

    alone: bool | None = None
    if any(k in norm for k in ("z kimś", "z kims", "z dzieck", "z rodzina", "z zona", "z mezem", "razem z")):
        alone = False
    elif any(k in norm for k in ("sam ", "sama ", "jestem sam", "jestem sama", "sam/sama")):
        alone = True
    # „sam/sama” w pytaniu asystenta nie powinno ustawiać faktu — filtrujemy poniżej po user blob

    public_unit = any(
        k in norm
        for k in ("jednostce publicznej", "jednostka publiczna", "publiczn", "mops", "gmina", "miasto")
    )

    place_label = ""
    if "zablocie" in norm and "krakow" in norm:
        place_label = "Zabłocie, Kraków"
    elif "krakow" in norm:
        place_label = "Kraków"
    elif _has_location_cue(text):
        place_label = "podana lokalizacja"

    return {
        "location": _has_location_cue(text),
        "place_label": place_label,
        "duration": duration,
        "alone": alone,
        "public_unit": public_unit,
        "topics": _topic_flags(text),
    }


def _user_blob(messages_text: str, user_text: str) -> str:
    """Tylko wypowiedzi użytkownika z historii (linie bez typowego tonu asystenta)."""
    # history_text miesza role — bierzemy całość + aktualną; fakty z pytań asystenta
    # typu „sam/sama” ignorujemy przez słabsze reguły alone powyżej.
    return f"{messages_text}\n{user_text}".strip()


def _pick_unit_id(system_text: str, prefer_public: bool) -> str:
    units: list[tuple[str, str]] = []
    for line in system_text.splitlines():
        if not line.startswith("UNIT|"):
            continue
        parts = line.split("|", 4)
        if len(parts) >= 3:
            units.append((parts[1].strip(), parts[2].strip()))
    if not units:
        return ""
    if prefer_public:
        for uid, name in units:
            n = _normalize(name)
            if any(k in n for k in ("mops", "gmina", "miasto", "ops", "pomoc")):
                return uid
    return units[0][0]


def _housing_draft(facts: dict[str, object], system_text: str) -> str:
    place = str(facts.get("place_label") or "lokalizacja do uzupełnienia")
    duration = "wsparcie długoterminowe" if facts.get("duration") == "long" else (
        "pilny nocleg / wsparcie na już" if facts.get("duration") == "short" else "wsparcie mieszkaniowe"
    )
    alone = facts.get("alone")
    who = "osoba sama" if alone is True else ("z osobą bliską" if alone is False else "skład gospodarstwa do potwierdzenia")
    public = "Preferencja: jednostka publiczna. " if facts.get("public_unit") else ""
    unit_id = _pick_unit_id(system_text, prefer_public=bool(facts.get("public_unit")))
    desc = (
        f"Potrzeba mieszkaniowa ({duration}). Miejsce: {place}. "
        f"{public}Sytuacja: {who}. "
        "Zebrane z rozmowy z mieszkańcem przez społecznego opiekuna MaloHUB."
    )
    place_bit = f" na {place}" if place and place != "lokalizacja do uzupełnienia" else ""
    horizon = "na dłużej" if facts.get("duration") == "long" else "na już"
    return (
        f"Dzięki — mam już obraz: brak stabilnego mieszkania{place_bit}, "
        f"zależy Ci na wsparciu **{horizon}**"
        + (", najlepiej w jednostce publicznej" if facts.get("public_unit") else "")
        + ".\n\n"
        "Przekazuję to jako **propozycję dla zespołu MaloHUB**, żeby właściwa jednostka "
        "mogła przejąć sprawę i dopracować dalsze kroki.\n\n"
        "Jeśli chcesz coś dopisać (np. czy jesteś sam/sama) — napisz śmiało.\n\n"
        "[[hubmi-new-project]]\n"
        "NAME: Wsparcie mieszkaniowe — długoterminowe\n"
        f"UNIT_ID: {unit_id}\n"
        f"DESCRIPTION: {desc}\n"
        "[[/hubmi-new-project]]"
    )


def _fake_complete(user_text: str, system_text: str, history_text: str = "") -> str:
    """Ciepła odpowiedź opiekuna — uwzględnia to, co już wiadomo z rozmowy."""
    if not user_text:
        return (
            "Cześć — opowiedz krótko, co Cię zajmuje. "
            "Mogę poszukać sensownego kierunku w MaloHUB albo po prostu pomóc poukładać sprawę."
        )

    # System ukrył listę projektów / oznaczył ogólnik — tylko dopytaj
    if "lista projektów ukryta" in system_text or "brak konkretnego tematu" in system_text:
        return (
            "Jasne — jestem tu, żeby pomóc.\n\n"
            "Napisz proszę krótko, **czego konkretnie potrzebujesz** "
            "(np. wsparcie mieszkaniowe, sprawa na ulicy, zdrowie / spektrum) "
            "i **gdzie** to się dzieje. Potem dobierzemy kierunek."
        )

    # Fakty głównie z treści usera: history_text zawiera też odpowiedzi asystenta,
    # więc do duration/public bierzemy blob; do alone ostrożnie.
    context = _user_blob(history_text, user_text)
    facts = _extract_facts(context)
    # Poprawka alone: nie dziedzicz z pytań asystenta „sam/sama”
    user_only = "\n".join(
        line
        for line in context.splitlines()
        if not line.startswith("Słyszę")
        and "powiedz jeszcze" not in line.casefold()
        and "Żeby dobrze" not in line
    )
    user_facts = _extract_facts(f"{user_only}\n{user_text}")
    facts["alone"] = user_facts["alone"]
    facts["duration"] = user_facts["duration"] or facts["duration"]
    facts["public_unit"] = bool(user_facts["public_unit"] or facts["public_unit"])

    topics: set[str] = facts["topics"]  # type: ignore[assignment]
    known_location = bool(facts["location"])
    projects = _parse_projects_from_system(system_text)

    ranked = sorted(
        ((p, _score_project(context, p)) for p in projects),
        key=lambda item: item[1],
        reverse=True,
    )
    matches = [(p, s) for p, s in ranked if s >= 55][:2]

    if matches:
        lead = "Dzięki — z tego, co mówisz"
        if "housing" in topics and known_location:
            lead = "Słyszę, że chodzi o dach nad głową w okolicy, którą podałeś"
        elif known_location:
            lead = "Trzymam się tego, co już wiem o miejscu i sprawie"
        lines = [f"{lead}. Widzę sensowny kierunek w MaloHUB:"]
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
                "Pasuje Ci ta ścieżka, czy raczej szukamy czegoś innego?",
                "",
                format_project_markers([str(p["id"]) for p, _ in matches]),
            ]
        )
        return "\n".join(lines)

    if "safety" in topics:
        return (
            "Jeśli jesteś w bezpośrednim niebezpieczeństwie — zadzwoń proszę na **112**.\n\n"
            "Jestem z Tobą. Napisz krótko, czy jesteś teraz w bezpiecznym miejscu, "
            "a jeśli możesz, udostępnij aktualną lokalizację.\n\n"
            "[[hubmi-need-location:gps]]"
        )

    if "housing" in topics:
        place = ""
        if facts.get("place_label"):
            place = f" ({facts['place_label']})"
        # Wystarczy lokalizacja + horyzont czasowy → propozycja, nie kolejne to samo pytanie
        if known_location and facts.get("duration") in {"long", "short"}:
            return _housing_draft(facts, system_text)

        if not known_location:
            return (
                f"Słyszę, że chodzi o dach nad głową{place}.\n\n"
                "Powiedz proszę, **gdzie** mniej więcej jesteś (miasto / dzielnica) — "
                "wtedy ruszamy dalej."
            )
        if facts.get("duration") is None:
            return (
                f"Dzięki — brak mieszkania{place} już rozumiem.\n\n"
                "Powiedz jeszcze tylko: potrzebujesz wsparcia **na już** (nocleg), "
                "czy raczej **na dłużej**?"
            )
        # duration znane, lokalizacja niepewna — nie powinno się zdarzyć często
        return (
            f"Trzymam: wsparcie mieszkaniowe{place}. "
            "Dopisz proszę jedno zdanie o sytuacji (czy jesteś sam/sama) — "
            "albo od razu złożę propozycję dla zespołu."
        )

    if "road" in topics and not known_location:
        return (
            "Jasne — chodzi o problem z drogą / jezdnią.\n\n"
            "Żeby dobrze to skierować, potrzebuję jeszcze **gdzie dokładnie** "
            "(ulica, numer albo charakterystyczny punkt).\n\n"
            "[[hubmi-need-location:area]]"
        )

    if known_location:
        return (
            f"Trzymam to, co już napisałeś: „{user_text[:140]}”. "
            "Lokalizację mam.\n\n"
            "Powiedz proszę jeszcze jednym zdaniem, **czego najbardziej potrzebujesz teraz** "
            "— wtedy dobiorę kierunek albo złożę propozycję dla zespołu MaloHUB."
        )

    return (
        f"Słyszę Cię: „{user_text[:140]}”.\n\n"
        "Żeby nie zgadywać na ślepo — napisz proszę krótko, **czego konkretnie potrzebujesz** "
        "i **gdzie** to się dzieje. Potem dobierzemy sensowny kierunek."
    )


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
    if provider == "openai":
        return OpenAILLMClient(
            api_key=settings.llm_api_key,
            model=settings.llm_model or "gpt-4o-mini",
        )
    if provider == "gemini":
        return GeminiLLMClient(
            api_key=settings.llm_api_key,
            model=settings.llm_model,
        )
    return FakeLLMClient()
