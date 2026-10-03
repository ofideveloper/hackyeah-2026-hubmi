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

        if "reports" in tables:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(reports)")).fetchall()
            }
            if "status" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE reports ADD COLUMN status VARCHAR(32) "
                        "NOT NULL DEFAULT 'nowe'"
                    )
                )

        if "users" in tables:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
            }
            if "name" not in cols:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT ''")
                )
            if "surname" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN surname VARCHAR(255) NOT NULL DEFAULT ''"
                    )
                )
            if "phone_number" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(32)"))
            # Backfill z full_name (pierwsze słowo → name, reszta → surname)
            conn.execute(
                text(
                    """
                    UPDATE users
                    SET
                      name = CASE
                        WHEN (name IS NULL OR name = '')
                             AND full_name IS NOT NULL AND trim(full_name) != ''
                        THEN trim(substr(full_name, 1, instr(full_name || ' ', ' ') - 1))
                        ELSE name
                      END,
                      surname = CASE
                        WHEN (surname IS NULL OR surname = '')
                             AND full_name IS NOT NULL
                             AND instr(trim(full_name), ' ') > 0
                        THEN trim(substr(full_name, instr(full_name, ' ') + 1))
                        ELSE surname
                      END
                    """
                )
            )
