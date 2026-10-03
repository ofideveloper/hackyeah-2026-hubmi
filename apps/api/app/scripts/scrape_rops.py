"""Scraper Biblioteki Innowacji Społecznych (rops.krakow.pl) → tabela `ActualProject`.

Uruchomienie (z `apps/api`):

    .venv/bin/python -m app.scripts.scrape_rops [URL_KATEGORII] [--dry-run]

Kategoria (`CategoriesOfProjects`) bierze nazwę z nagłówka strony i jest tworzona,
jeśli jej nie ma. Ponowne uruchomienie aktualizuje opisy zamiast dublować projekty.
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
from ..models import ActualProject, CategoriesOfProjects

DEFAULT_URL = (
    "https://rops.krakow.pl/innowacje-spoleczne/"
    "biblioteka-innowacji-spolecznych/dla-seniorow"
)
USER_AGENT = "HubMI-scraper/0.1 (HackYeah 2026)"
REQUEST_DELAY_S = 0.3

BLOCK_TAGS = {"h4", "p", "li"}


@dataclass
class ScrapedProject:
    name: str
    description: str
    url: str


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

    def _flush(self) -> None:
        if self._block is not None:
            text = clean("".join(self._text))
            if text:
                self.blocks.append(f"- {text}" if self._block == "li" else text)
        self._block = None
        self._text = []


def scrape(listing_url: str) -> tuple[str, list[ScrapedProject]]:
    listing = ListingParser()
    listing.feed(fetch(listing_url))
    if not listing.category or not listing.items:
        raise RuntimeError(f"Nie znaleziono listy innowacji na {listing_url}")

    projects: list[ScrapedProject] = []
    for name, href in listing.items:
        url = urljoin(listing_url, href)
        time.sleep(REQUEST_DELAY_S)
        detail = DetailParser()
        detail.feed(fetch(url))
        description = "\n".join(detail.blocks)
        if not description:
            print(f"  ! pominięto (brak opisu): {name} — {url}")
            continue
        projects.append(ScrapedProject(detail.title or name, description, url))
        print(f"  pobrano: {projects[-1].name} ({len(description)} znaków)")
    return listing.category, projects


def save(category_name: str, projects: list[ScrapedProject]) -> tuple[int, int]:
    """Zwraca (dodane, zaktualizowane)."""
    create_db_and_tables()
    created = updated = 0
    with Session(engine) as session:
        category = session.exec(
            select(CategoriesOfProjects).where(CategoriesOfProjects.name == category_name)
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
            if project is None:
                session.add(
                    ActualProject(
                        category_id=category.id,
                        name=scraped.name,
                        description=scraped.description,
                    )
                )
                created += 1
            elif project.description != scraped.description:
                project.description = scraped.description
                session.add(project)
                updated += 1
        session.commit()
    return created, updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("url", nargs="?", default=DEFAULT_URL)
    parser.add_argument("--dry-run", action="store_true", help="pobierz, ale nie zapisuj")
    args = parser.parse_args()

    category, projects = scrape(args.url)
    print(f"Kategoria „{category}”: {len(projects)} projektów")
    if args.dry_run:
        for project in projects[:1]:
            print(f"\n--- {project.name}\n{project.description}")
        return
    created, updated = save(category, projects)
    print(f"Zapisano: {created} nowych, {updated} zaktualizowanych")


if __name__ == "__main__":
    main()
