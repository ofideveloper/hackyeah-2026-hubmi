"""Parsowanie markerów projektów z odpowiedzi AI → karty w UI czatu."""

from __future__ import annotations

import re

# Model dokleja na końcu odpowiedzi; UI ich nie pokazuje.
PROJECT_MARKER_RE = re.compile(r"\[\[hubmi-project:(\d+)\]\]", re.IGNORECASE)


def extract_project_ids(content: str) -> tuple[str, list[int]]:
    """Zwraca (tekst bez markerów, unikalne id projektów w kolejności wystąpienia)."""
    ids: list[int] = []
    seen: set[int] = set()
    for match in PROJECT_MARKER_RE.finditer(content):
        pid = int(match.group(1))
        if pid not in seen:
            seen.add(pid)
            ids.append(pid)
    cleaned = PROJECT_MARKER_RE.sub("", content)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned, ids


def format_project_markers(project_ids: list[int]) -> str:
    return " ".join(f"[[hubmi-project:{pid}]]" for pid in project_ids)
