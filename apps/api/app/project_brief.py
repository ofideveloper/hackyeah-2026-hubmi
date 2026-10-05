"""Skrót projektu do promptu czatu — pełny opis zostaje w bazie i na FE po dopasowaniu."""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from typing import TypeAlias

from .dependencies.logger import get_logger

logger = get_logger(__name__)

BRIEF_MAX = 480

# Opisy z Biblioteki Innowacji: „1. Na czym polega…”, „2. Jakich problemów…”, „3. Grupa docelowa”.
SECTION_RE = re.compile(r"^(\d{1,2})\.\s+(.{3,120})$")

AskLlm: TypeAlias = Callable[[list[dict[str, str]]], Awaitable[str]]

BRIEF_LLM_SYSTEM = """Na podstawie nazwy i pełnego opisu innowacji społecznej napisz krótki skrót po polsku (2–3 zdania, maks. 400 znaków).
Uwzględnij: dla kogo (wiek/rola/grupa), jaki problem, na czym polega rozwiązanie.
Bez list, bez nagłówków, bez zmyślonych faktów. Tylko treść skrótu — nic więcej."""


def _clip(text: str, limit: int = BRIEF_MAX) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return f"{cut or text[: limit - 1]}…"


def _sections(description: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    lines: list[str] = []
    title = ""
    for line in description.splitlines():
        match = SECTION_RE.match(line.strip())
        if match:
            if title or lines:
                sections.append((title, "\n".join(lines).strip()))
            title, lines = match.group(2).strip(), []
        else:
            lines.append(line)
    if title or lines:
        sections.append((title, "\n".join(lines).strip()))
    return sections


def _pick(sections: list[tuple[str, str]], *needles: str, limit: int = 160) -> str:
    for title, body in sections:
        folded = title.casefold()
        if any(needle in folded for needle in needles) and body.strip():
            return _clip(body, limit)
    return ""


def brief_from_description(name: str, description: str) -> str:
    """Buduje skrót bez LLM — z sekcji ROPS albo z początku opisu."""
    sections = _sections(description)
    audience = _pick(sections, "grupa docelowa", "odbiorc")
    problem = _pick(sections, "problem")
    solution = _pick(sections, "na czym polega", "rozwiązanie")
    parts: list[str] = []
    if audience:
        parts.append(f"Dla kogo: {audience}")
    if problem:
        parts.append(f"Problem: {problem}")
    if solution:
        parts.append(f"Rozwiązanie: {solution}")
    if parts:
        return _clip(" | ".join(parts))
    plain = re.sub(r"\s+", " ", description or "").strip()
    if plain:
        return _clip(plain)
    return _clip(name or "")


async def refine_brief_with_llm(
    ask_llm: AskLlm,
    name: str,
    description: str,
    *,
    fallback: str | None = None,
) -> str:
    """Prosi model o skrót; przy błędzie / pustce wraca do heurystyki."""
    heuristic = fallback if fallback is not None else brief_from_description(name, description)
    try:
        raw = await ask_llm(
            [
                {"role": "system", "content": BRIEF_LLM_SYSTEM},
                {
                    "role": "user",
                    "content": f"Nazwa: {name}\n\nOpis:\n{(description or '')[:4000]}",
                },
            ]
        )
    except Exception as exc:
        logger.warning(
            "Skrót LLM nieudany (%s) — używam heurystyki", type(exc).__name__
        )
        return heuristic
    text = _clip(re.sub(r"\s+", " ", (raw or "").strip()))
    if len(text) < 20:
        return heuristic
    return text
