"""Lekkie poprawki schematu SQLite — create_all nie zmienia istniejących tabel."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_sqlite_schema(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).fetchall()
        }

        if "projects" in tables:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(projects)")).fetchall()
            }
            # Starsza wersja miała `title` zamiast `name`
            if "title" in cols and "name" not in cols:
                conn.execute(text("ALTER TABLE projects RENAME COLUMN title TO name"))
