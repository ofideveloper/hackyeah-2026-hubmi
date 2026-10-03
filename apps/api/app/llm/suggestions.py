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

# Soft CTA: UI pokazuje „Zapisz zgłoszenie”
REPORT_OFFER_RE = re.compile(r"\[\[hubmi-offer-report\]\]", re.IGNORECASE)

# Nowe zgłoszenie / sprawa mieszkańca → Report
NEW_REPORT_BLOCK_RE = re.compile(
    r"\[\[hubmi-new-report\]\](.*?)\[\[/hubmi-new-report\]\]",
    re.IGNORECASE | re.DOTALL,
)

_REPORT_KINDS = {"problem", "wydarzenie", "informacja"}


@dataclass
class NewProjectDraft:
    name: str
    description: str
    suggested_unit_id: uuid.UUID | None = None


@dataclass
class NewReportDraft:
    title: str
    description: str
    kind: str = "problem"
    unit_id: uuid.UUID | None = None


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


def extract_report_offer(content: str) -> tuple[str, bool]:
    """Zwraca (tekst bez markera, czy pokazać CTA zgłoszenia)."""
    if not REPORT_OFFER_RE.search(content):
        return content, False
    cleaned = REPORT_OFFER_RE.sub("", content)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned, True


def extract_new_report_draft(content: str) -> tuple[str, NewReportDraft | None]:
    """Wyciąga blok nowego zgłoszenia (sprawy) i czyści tekst dla UI."""
    # Modele czasem owijają markery w fence ``` 
    normalized = re.sub(r"```+\w*", "", content)
    match = NEW_REPORT_BLOCK_RE.search(normalized)
    if not match:
        return content, None

    body = match.group(1).strip()
    draft = _parse_new_report_body(body)
    cleaned = NEW_REPORT_BLOCK_RE.sub("", normalized, count=1)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned, draft


def _parse_new_report_body(body: str) -> NewReportDraft | None:
    title = ""
    kind = "problem"
    unit_raw = ""
    desc_lines: list[str] = []
    in_desc = False

    for line in body.splitlines():
        stripped = line.strip().lstrip("-* ").strip()
        upper = stripped.upper()
        if upper.startswith("TITLE:") or upper.startswith("NAME:"):
            title = stripped.split(":", 1)[1].strip()
            in_desc = False
            continue
        if upper.startswith("KIND:") or upper.startswith("TYPE:"):
            kind = stripped.split(":", 1)[1].strip().lower()
            in_desc = False
            continue
        if upper.startswith("UNIT_ID:") or upper.startswith("UNIT:"):
            unit_raw = stripped.split(":", 1)[1].strip()
            in_desc = False
            continue
        if upper.startswith("DESCRIPTION:") or upper.startswith("DESC:"):
            first = stripped.split(":", 1)[1].strip()
            desc_lines = [first] if first else []
            in_desc = True
            continue
        if in_desc:
            desc_lines.append(line.rstrip())

    description = "\n".join(desc_lines).strip()
    # Fallback: cały body jako opis, pierwsza linia jako tytuł
    if (len(title) < 2 or len(description) < 2) and body.strip():
        lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
        if not title and lines:
            title = lines[0][:255]
        if len(description) < 2:
            description = "\n".join(lines)[:5000]
    if len(title) < 2 or len(description) < 2:
        return None
    if kind not in _REPORT_KINDS:
        kind = "problem"

    unit_id: uuid.UUID | None = None
    if unit_raw:
        try:
            unit_id = uuid.UUID(unit_raw)
        except ValueError:
            unit_id = None

    return NewReportDraft(
        title=title[:255],
        description=description[:5000],
        kind=kind,
        unit_id=unit_id,
    )


_REPORT_CONFIRM_CUES = (
    "zapisz to proszę jako zgłoszenie",
    "zapisz to prosze jako zgloszenie",
    "zapisz jako zgłoszenie",
    "zapisz jako zgloszenie",
    "tak, zapisz",
    "tak zapisz",
    "chcę śledzić status",
    "chce sledzic status",
)

_STARTER_SKIP = {
    "chcę zgłosić problem w okolicy",
    "chce zglosic problem w okolicy",
    "chcę zgłosić problem",
    "chce zglosic problem",
}


def is_report_confirm(message: str) -> bool:
    norm = " ".join(message.casefold().split())
    return any(cue in norm for cue in _REPORT_CONFIRM_CUES)


def synthesize_report_draft(
    history_blob: str,
    user_message: str,
) -> NewReportDraft | None:
    """Złóż draft sprawy z historii, gdy model zapomniał markera."""
    parts: list[str] = []
    for chunk in (history_blob or "").split("\n"):
        text = chunk.strip()
        if text:
            parts.append(text)
    current = user_message.strip()
    if current and not is_report_confirm(current):
        parts.append(current)

    facts = [
        p
        for p in parts
        if p.casefold() not in _STARTER_SKIP and not is_report_confirm(p)
    ]
    if not facts:
        return None

    description = "\n".join(facts).strip()
    if len(description) < 8:
        return None

    title_source = facts[-1] if len(facts[-1]) >= 8 else facts[0]
    title = title_source[:80].rstrip()
    if len(title_source) > 80:
        title = title[:77].rstrip() + "…"
    if len(title) < 2:
        title = "Zgłoszenie z czatu"

    return NewReportDraft(
        title=title,
        description=description[:5000],
        kind="problem",
        unit_id=None,
    )


def format_project_markers(project_ids: list[str] | list[int]) -> str:
    return " ".join(f"[[hubmi-project:{pid}]]" for pid in project_ids)
