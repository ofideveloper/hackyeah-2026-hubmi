"""Parsowanie markerów z odpowiedzi AI → karty / propozycje projektów."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

# Istniejące projekty → karty w UI (UUID lub legacy int)
PROJECT_MARKER_RE = re.compile(
    r"\[\[hubmi-project:([0-9a-fA-F-]{36}|\d+)\]\]",
    re.IGNORECASE,
)

# Nowy projekt zebrany w rozmowie → kolejka admina
NEW_PROJECT_BLOCK_RE = re.compile(
    r"\[\[hubmi-new-project\]\](.*?)\[\[/hubmi-new-project\]\]",
    re.IGNORECASE | re.DOTALL,
)

# Prośba o lokalizację → przycisk w UI czatu
LOCATION_MARKER_RE = re.compile(
    r"\[\[hubmi-need-location:(area|gps)\]\]",
    re.IGNORECASE,
)


@dataclass
class NewProjectDraft:
    name: str
    description: str
    suggested_unit_id: uuid.UUID | None = None


def _parse_id(raw: str) -> str:
    """Normalizuje id markera do stringa (UUID lowercase albo cyfry)."""
    text = raw.strip()
    try:
        return str(uuid.UUID(text))
    except ValueError:
        return text


def extract_project_ids(content: str) -> tuple[str, list[str]]:
    """Zwraca (tekst bez markerów kart, unikalne id projektów jako string)."""
    ids: list[str] = []
    seen: set[str] = set()
    for match in PROJECT_MARKER_RE.finditer(content):
        pid = _parse_id(match.group(1))
        if pid not in seen:
            seen.add(pid)
            ids.append(pid)
    cleaned = PROJECT_MARKER_RE.sub("", content)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned, ids


def extract_new_project_draft(content: str) -> tuple[str, NewProjectDraft | None]:
    """Wyciąga pierwszy blok nowej propozycji projektu i czyści tekst dla UI."""
    match = NEW_PROJECT_BLOCK_RE.search(content)
    if not match:
        return content, None

    body = match.group(1).strip()
    draft = _parse_new_project_body(body)
    cleaned = NEW_PROJECT_BLOCK_RE.sub("", content, count=1)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned, draft


def _parse_new_project_body(body: str) -> NewProjectDraft | None:
    name = ""
    unit_raw = ""
    desc_lines: list[str] = []
    in_desc = False

    for line in body.splitlines():
        stripped = line.strip()
        upper = stripped.upper()
        if upper.startswith("NAME:"):
            name = stripped.split(":", 1)[1].strip()
            in_desc = False
            continue
        if upper.startswith("UNIT_ID:"):
            unit_raw = stripped.split(":", 1)[1].strip()
            in_desc = False
            continue
        if upper.startswith("DESCRIPTION:"):
            first = stripped.split(":", 1)[1].strip()
            desc_lines = [first] if first else []
            in_desc = True
            continue
        if in_desc:
            desc_lines.append(line.rstrip())

    description = "\n".join(desc_lines).strip()
    if len(name) < 2 or len(description) < 2:
        return None

    unit_id: uuid.UUID | None = None
    if unit_raw:
        try:
            unit_id = uuid.UUID(unit_raw)
        except ValueError:
            unit_id = None

    return NewProjectDraft(
        name=name[:255],
        description=description[:5000],
        suggested_unit_id=unit_id,
    )


def extract_location_request(content: str) -> tuple[str, str | None]:
    """Zwraca (tekst bez markera, 'area'|'gps'|None)."""
    match = LOCATION_MARKER_RE.search(content)
    if not match:
        return content, None
    kind = match.group(1).lower()
    cleaned = LOCATION_MARKER_RE.sub("", content)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    if kind not in {"area", "gps"}:
        return cleaned, None
    return cleaned, kind


def format_project_markers(project_ids: list[str] | list[int]) -> str:
    return " ".join(f"[[hubmi-project:{pid}]]" for pid in project_ids)
