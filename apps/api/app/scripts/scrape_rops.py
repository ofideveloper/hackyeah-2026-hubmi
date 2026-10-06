"""Scraper Biblioteki Innowacji Społecznych (rops.krakow.pl) → tabela `ActualProject`.

Uruchomienie (z `apps/api`):

    .venv/bin/python -m app.scripts.scrape_rops [URL_KATEGORII ...] [--dry-run]

Bez argumentów pobiera wszystkie kategorie z `CATEGORY_SLUGS`. Kategoria
(`CategoriesOfProjects`) bierze nazwę z nagłówka strony i jest tworzona, jeśli jej
nie ma. Ponowne uruchomienie aktualizuje opisy zamiast dublować projekty.

Przy starcie API pusta Biblioteka wypełnia się sama (`seed_innovation_library` w
`app/seed.py`): ze zrzutu `app/seed_data/innovation_library.json`, a gdy go brak —
tym scraperem (wyłącznik: `SCRAPE_ON_STARTUP=false`).
"""

import argparse
import re
import time
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin

from sqlmodel import Session, select

from ..dependencies.db import create_db_and_tables, engine
from ..dependencies.logger import get_logger
from ..models import ActualProject, CategoriesOfProjects
from ..project_brief import brief_from_description

logger = get_logger(__name__)

BASE_URL = (
    "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/"
)
CATEGORY_SLUGS = (
    "dla-seniorow",
    "dla-dzieci-mlodziezy-i-rodziny",
    "dla-osob-z-niepelnosprawnoscia-intelektualna",
    "dla-osob-z-niepelnosprawnoscia-sensoryczna",
    "dla-osob-o-ograniczonej-mobilnosci",
    "dla-osob-w-kryzysie-bezdomnosci",
    "dla-cudzoziemcow",
    "dla-rynku-pracy",
    "dla-zdrowia-i-medycyny",
)
DEFAULT_URLS = [urljoin(BASE_URL, slug) for slug in CATEGORY_SLUGS]
USER_AGENT = "MaloHUB-scraper/0.1 (HackYeah 2026)"
REQUEST_DELAY_S = 0.3

BLOCK_TAGS = {"h4", "p", "li"}
VIDEO_RE = re.compile(r"youtube\.com/watch\?|youtu\.be/", re.IGNORECASE)


@dataclass
class ScrapedProject:
    name: str
    description: str
    url: str
    video_url: str | None = None
    folder_url: str | None = None


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def clean(text: str) -> str:
    # ​ — zero-width space wklejany w treści przez CMS
    return re.sub(r"\s+", " ", text.replace("​", "")).strip()


class ListingParser(HTMLParser):
    """Strona kategorii: nazwa kategorii + linki `a.news-list__title`."""

    def __init__(self) -> None:
        super().__init__()
        self.category = ""
        self.items: list[tuple[str, str]] = []
        self._in_title = False
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = (attrs.get("class") or "").split()
        if tag == "h2" and "page-title" in classes:
            self._in_title = True
            self._text = []
        elif tag == "a" and "news-list__title" in classes:
            self._href = attrs.get("href")
            self._text = []

    def handle_data(self, data):
        if self._in_title or self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "h2" and self._in_title:
            self.category = clean("".join(self._text))
            self._in_title = False
        elif tag == "a" and self._href is not None:
            self.items.append((clean("".join(self._text)), self._href))
            self._href = None


class DetailParser(HTMLParser):
    """Strona innowacji: tytuł + sekcje od pierwszego `<h4>` w `div.text-content`."""

    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.blocks: list[str] = []
        self.video_url: str | None = None  # pierwszy film o innowacji (YouTube)
        self.folder_url: str | None = None  # pierwszy folder PDF
        self._in_title = False
        self._div_depth = 0  # > 0 wewnątrz div.text-content
        self._started = False  # po pierwszym <h4> (pomija baner i tabelę z ikonami)
        self._block: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag, attrs):
        classes = (dict(attrs).get("class") or "").split()
        if tag == "h2" and "page-title" in classes:
            self._in_title = True
            self._text = []
        elif tag == "div":
            if self._div_depth:
                self._div_depth += 1
            elif "text-content" in classes and not self.blocks:
                self._div_depth = 1
        elif self._div_depth:
            if tag == "a":
                self._collect_link(dict(attrs).get("href") or "")
            if tag == "h4":
                self._started = True
            if tag in BLOCK_TAGS and self._started:
                self._flush()
                self._block = tag
            elif tag == "br":
                self._text.append(" ")

    def handle_data(self, data):
        if self._in_title or self._block is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "h2" and self._in_title:
            self.title = clean("".join(self._text))
            self._in_title = False
            self._text = []
        elif tag == "div" and self._div_depth:
            self._div_depth -= 1
            if not self._div_depth:
                self._flush()
        elif tag == self._block:
            self._flush()

    def _collect_link(self, href: str) -> None:
        if self.video_url is None and VIDEO_RE.search(href):
            self.video_url = href
        elif self.folder_url is None and href.lower().split("?")[0].endswith(".pdf"):
            self.folder_url = href

    def _flush(self) -> None:
        if self._block is not None:
            text = clean("".join(self._text))
            if text:
                self.blocks.append(f"- {text}" if self._block == "li" else text)
        self._block = None
        self._text = []


def scrape(
    listing_url: str, known: dict[str, set[str]] | None = None
) -> tuple[str, list[ScrapedProject]]:
    """`known` (kategoria → nazwy już zapisane) pomija pobieranie stron tych innowacji."""
    listing = ListingParser()
    listing.feed(fetch(listing_url))
    if not listing.category or not listing.items:
        raise RuntimeError(f"Nie znaleziono listy innowacji na {listing_url}")

    skip = (known or {}).get(listing.category, set())
    projects: list[ScrapedProject] = []
    for name, href in listing.items:
        if name in skip:
            continue
        url = urljoin(listing_url, href)
        time.sleep(REQUEST_DELAY_S)
        detail = DetailParser()
        detail.feed(fetch(url))
        description = "\n".join(detail.blocks)
        if not description:
            print(f"  ! pominięto (brak opisu): {name} — {url}")
            continue
        title = detail.title or name
        # zapis rozpoznaje projekt po nazwie — duplikat nadpisywałby poprzedni wpis
        if any(project.name == title for project in projects):
            print(f"  ! pominięto (powtórzona nazwa): {title} — {url}")
            continue
        projects.append(
            ScrapedProject(
                title,
                description,
                url,
                video_url=detail.video_url,
                folder_url=urljoin(url, detail.folder_url)
                if detail.folder_url
                else None,
            )
        )
        print(f"  pobrano: {projects[-1].name} ({len(description)} znaków)")
    return listing.category, projects


def save(category_name: str, projects: list[ScrapedProject]) -> tuple[int, int]:
    """Zwraca (dodane, zaktualizowane)."""
    create_db_and_tables()
    created = updated = 0
    with Session(engine) as session:
        category = session.exec(
            select(CategoriesOfProjects).where(
                CategoriesOfProjects.name == category_name
            )
        ).first()
        if category is None:
            category = CategoriesOfProjects(name=category_name)
            session.add(category)
            session.flush()

        for scraped in projects:
            project = session.exec(
                select(ActualProject).where(
                    ActualProject.category_id == category.id,
                    ActualProject.name == scraped.name,
                )
            ).first()
            brief = brief_from_description(scraped.name, scraped.description)
            fields = {
                "description": scraped.description,
                "brief": brief,
                "source_url": scraped.url,
                "video_url": scraped.video_url,
                "folder_url": scraped.folder_url,
            }
            if project is None:
                session.add(
                    ActualProject(category_id=category.id, name=scraped.name, **fields)
                )
                created += 1
            elif any(getattr(project, key) != value for key, value in fields.items()):
                for key, value in fields.items():
                    setattr(project, key, value)
                session.add(project)
                updated += 1
        session.commit()
    return created, updated


def refresh_new_projects() -> int:
    """Dociąga innowacje, których nie ma jeszcze w bazie. Zwraca liczbę dodanych.

    Istniejących wpisów nie pobiera ponownie (tylko strony kategorii), więc nadaje
    się do wywołania w trakcie żądania — pełna aktualizacja opisów to `main()`.
    """
    create_db_and_tables()
    known: dict[str, set[str]] = {}
    with Session(engine) as session:
        rows = session.exec(
            select(CategoriesOfProjects.name, ActualProject.name).join(
                ActualProject, ActualProject.category_id == CategoriesOfProjects.id
            )
        ).all()
    for category_name, project_name in rows:
        known.setdefault(category_name, set()).add(project_name)

    added = 0
    for url in DEFAULT_URLS:
        try:
            category, projects = scrape(url, known)
        except (OSError, RuntimeError) as error:
            logger.warning("Pominięto kategorię %s: %s", url, error)
            continue
        if projects:
            created, _updated = save(category, projects)
            logger.info("Kategoria „%s”: dodano %s nowych projektów", category, created)
            added += created
    return added


def main() -> None:
    assert __doc__ is not None
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "urls", nargs="*", default=DEFAULT_URLS, help="domyślnie wszystkie kategorie"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="pobierz, ale nie zapisuj"
    )
    args = parser.parse_args()

    failed: list[str] = []
    for url in args.urls:
        try:
            category, projects = scrape(url)
        except (OSError, RuntimeError) as error:
            print(f"! pominięto kategorię {url}: {error}")
            failed.append(url)
            continue
        print(f"Kategoria „{category}”: {len(projects)} projektów")
        if args.dry_run:
            for project in projects[:1]:
                print(f"\n--- {project.name}\n{project.description}")
            continue
        created, updated = save(category, projects)
        print(f"Zapisano: {created} nowych, {updated} zaktualizowanych")
    if failed:
        raise SystemExit(f"Nie pobrano {len(failed)} z {len(args.urls)} kategorii")


if __name__ == "__main__":
    main()
