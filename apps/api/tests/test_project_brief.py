"""Testy skrótu projektu do promptu czatu."""

from app.project_brief import brief_from_description, refine_brief_with_llm
from app.seed import backfill_project_briefs


ROPS = (
    "1. Na czym polega rozwiązanie?\n"
    "Drewniana tablica z siedmioma elementami do stymulacji pamięci.\n"
    "2. Jakich problemów dotyczy innowacja?\n"
    "Rozpowszechnianie się zespołów otępiennych u osób w podeszłym wieku.\n"
    "3. Grupa docelowa\n"
    "Dorosłe osoby z otępieniem we wczesnym stadium.\n"
    "4. Kto może skorzystać z innowacji?\n"
    "Placówki wsparcia dziennego seniorów.\n"
    "5. Czy to działa?\n"
    "Test potwierdził skuteczność.\n"
)


def test_brief_from_rops_sections():
    brief = brief_from_description("BaWita", ROPS)

    assert "Dla kogo:" in brief
    assert "otępieniem" in brief
    assert "Problem:" in brief
    assert "otępiennych" in brief
    assert "Rozwiązanie:" in brief
    assert "tablica" in brief
    assert "Czy to działa" not in brief
    assert len(brief) <= 480


def test_brief_from_plain_description():
    brief = brief_from_description("Teleopieka", "Opaska z przyciskiem SOS dla seniorów.")

    assert brief == "Opaska z przyciskiem SOS dla seniorów."


def test_brief_falls_back_to_name_when_empty():
    assert brief_from_description("Sama nazwa", "   ") == "Sama nazwa"


def test_refine_brief_uses_llm_then_falls_back():
    import asyncio

    async def ok(_messages):
        return "Dla seniorów. Problem: samotność. Rozwiązanie: klub sąsiedzki."

    async def boom(_messages):
        raise RuntimeError("provider down")

    async def empty(_messages):
        return "ok"

    async def run():
        good = await refine_brief_with_llm(
            ok, "Klub", "Długi opis…", fallback="heurystyka"
        )
        assert "klub sąsiedzki" in good

        fallback = await refine_brief_with_llm(
            boom, "Klub", "Długi opis…", fallback="heurystyka"
        )
        assert fallback == "heurystyka"

        too_short = await refine_brief_with_llm(
            empty, "Klub", "Długi opis…", fallback="heurystyka"
        )
        assert too_short == "heurystyka"

    asyncio.run(run())


def test_backfill_project_briefs(db, make_project):
    empty = make_project(
        name="Bez skrótu",
        description="1. Na czym polega\nOpaska SOS.\n3. Grupa docelowa\nSeniorzy.",
        brief="",
    )
    filled = make_project(name="Już ma", description="Opis.", brief="Gotowy skrót.")

    assert backfill_project_briefs(db) == 1
    db.refresh(empty)
    db.refresh(filled)
    assert empty.brief
    assert "Seniorzy" in empty.brief or "Opaska" in empty.brief
    assert filled.brief == "Gotowy skrót."
    assert backfill_project_briefs(db) == 0
