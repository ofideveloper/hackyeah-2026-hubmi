"""Tryby pracy czatu — mapowanie intencji → zachowanie (katalog vs zgłoszenie vs intake)."""

from __future__ import annotations

from typing import Literal

ChatMode = Literal["clarify", "report", "catalog", "intake"]

VALID_MODES: set[str] = {"clarify", "report", "catalog", "intake"}

# Silne sygnały startowe (chip / pierwsza wiadomość)
_REPORT_CUES = (
    "chcę zgłosić",
    "chce zglosic",
    "chce zgłosić",
    "zgłosić problem",
    "zglosic problem",
    "zgłaszam",
    "zglaszam",
    "problem w okolicy",
    "zapisz zgłoszenie",
    "zapisz zgloszenie",
    "jako zgłoszenie",
    "jako zgloszenie",
    "śledzić status",
    "sledzic status",
    "złóż sprawę",
    "zloz sprawe",
)

_CATALOG_CUES = (
    "gotowego rozwiązania",
    "gotowe rozwiązanie",
    "gotowe rozwiazanie",
    "szukam rozwiązania",
    "szukam rozwiazania",
    "dla mojej gminy",
    "dla gminy",
    "katalog",
    "jakie macie projekty",
    "pokaż projekty",
    "pokaz projekty",
    "szukam projektu",
    "wdrożyć innowacj",
    "wdrozyc innowacj",
    "innowacj",
)

_INTAKE_CUES = (
    "pomysł oddolny",
    "pomysl oddolny",
    "nowy projekt",
    "nową inicjatyw",
    "nowa inicjatyw",
    "stworzyć projekt",
    "stworzyc projekt",
    "propozycja projektu",
    "inicjatywę do katalogu",
    "inicjatywe do katalogu",
)

_SWITCH_TO_CATALOG = (
    "raczej szukam projektu",
    "pokaż projekty",
    "pokaz projekty",
    "gotowe rozwiązanie",
    "gotowe rozwiazanie",
    "co już macie",
    "co juz macie",
)

_SWITCH_TO_REPORT = (
    "jednak chcę zgłosić",
    "jednak chce zglosic",
    "zapisz jako zgłoszenie",
    "zapisz jako zgloszenie",
    "wolę zgłoszenie",
    "wole zgloszenie",
)


def _norm(text: str) -> str:
    return " ".join(text.casefold().split())


def _has_any(text: str, cues: tuple[str, ...]) -> bool:
    return any(cue in text for cue in cues)


def detect_chat_mode(
    user_message: str,
    history_user_blob: str = "",
    preferred: str | None = None,
) -> ChatMode:
    """
    Wykryj tryb rozmowy.

    preferred — opcjonalny hint z frontu (chip); trzyma się go, dopóki user
    wyraźnie nie przełączy ścieżki.
    """
    current = _norm(user_message)
    history = _norm(history_user_blob)
    whole = f"{history} {current}".strip()

    if preferred in VALID_MODES and preferred != "clarify":
        if preferred == "report" and _has_any(current, _SWITCH_TO_CATALOG):
            return "catalog"
        if preferred == "catalog" and _has_any(current, _SWITCH_TO_REPORT):
            return "report"
        if preferred == "intake" and _has_any(current, _SWITCH_TO_REPORT):
            return "report"
        if preferred == "intake" and _has_any(current, _SWITCH_TO_CATALOG):
            return "catalog"
        return preferred  # type: ignore[return-value]

    # Najpierw aktualna wiadomość (silniejsza niż historia)
    if _has_any(current, _SWITCH_TO_CATALOG) or _has_any(current, _CATALOG_CUES):
        return "catalog"
    if _has_any(current, _SWITCH_TO_REPORT) or _has_any(current, _REPORT_CUES):
        return "report"
    if _has_any(current, _INTAKE_CUES):
        return "intake"

    # Sticky z historii usera
    if _has_any(history, _REPORT_CUES) and not _has_any(current, _CATALOG_CUES):
        return "report"
    if _has_any(history, _INTAKE_CUES) and not _has_any(current, _CATALOG_CUES):
        return "intake"
    if _has_any(history, _CATALOG_CUES):
        return "catalog"

    if _has_any(whole, _REPORT_CUES):
        return "report"
    if _has_any(whole, _INTAKE_CUES):
        return "intake"
    if _has_any(whole, _CATALOG_CUES):
        return "catalog"

    return "clarify"


def mode_instructions(mode: ChatMode) -> str:
    """Krótki nakaz systemowy wstrzykiwany do promptu."""
    if mode == "report":
        return (
            "TRYB AKTYWNY: report (zgłoszenie / sprawa).\n"
            "- Zbieraj: CO się dzieje, GDZIE, dla kogo, pilność.\n"
            "- NIE sugeruj PROJECT|, NIE dodawaj [[hubmi-project:…]], "
            "NIE wspominaj nazw projektów z katalogu.\n"
            "- Gdy masz zarys → [[hubmi-offer-report]]; po potwierdzeniu → [[hubmi-new-report]].\n"
            "- Lokalizacja: jeśli terenowa i brak miejsca → [[hubmi-need-location:area]].\n"
            "- Cel: zapisać sprawę do monitorowania, nie „sprzedać” projekt z katalogu."
        )
    if mode == "catalog":
        return (
            "TRYB AKTYWNY: catalog (katalog gotowych rozwiązań).\n"
            "- Szukaj dopasowania PROJECT|; przy kandydacie scoring — zaproponuj z markerem.\n"
            "- NIE otwieraj zgłoszenia ani intake, dopóki user wyraźnie nie chce zgłosić / nowego projektu.\n"
            "- Max 1–2 projekty; wyjaśnij dlaczego pasują do lokalnej potrzeby / JST."
        )
    if mode == "intake":
        return (
            "TRYB AKTYWNY: intake (nowa inicjatywa / projekt do katalogu).\n"
            "- Zbieraj materiał pod [[hubmi-new-project]] (nazwa, opis, UNIT_ID, lokalizacja).\n"
            "- NIE sugeruj istniejących PROJECT| „na zapas”.\n"
            "- To nie jest zwykłe zgłoszenie statusowe — to propozycja innowacji dla admina."
        )
    return (
        "TRYB AKTYWNY: clarify.\n"
        "- Ustal intencję jednym krótkim pytaniem LUB z chipów: "
        "zgłoszenie problemu / katalog rozwiązań / nowy pomysł.\n"
        "- Zero markerów projektów, zero zgłoszeń, zero zgadywania."
    )
