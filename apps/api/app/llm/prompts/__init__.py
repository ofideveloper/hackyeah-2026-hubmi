"""Prompty systemowe LLM — edytuj pliki `.md` w tym katalogu."""

from __future__ import annotations

from pathlib import Path

_PROMPTS_DIR = Path(__file__).resolve().parent


def load_prompt(name: str) -> str:
    """Wczytaj `name.md` (bez rozszerzenia) z `app/llm/prompts/`."""
    path = _PROMPTS_DIR / f"{name}.md"
    if not path.is_file():
        raise FileNotFoundError(f"Brak promptu: {path}")
    return path.read_text(encoding="utf-8").strip()
