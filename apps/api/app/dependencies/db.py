import os
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine, inspect, text
from sqlmodel import Session, SQLModel

from ..config import get_settings
from .logger import get_logger

logger = get_logger(__name__)


def resolve_database_url(url: str) -> str:
    """On Vercel the filesystem is ephemeral; keep SQLite under /tmp unless overridden."""
    if os.environ.get("VERCEL") and url.startswith("sqlite") and "/tmp/" not in url:
        logger.warning("Vercel: SQLite w /tmp — dane nietrwałe, ustaw DATABASE_URL")
        return "sqlite:////tmp/hubmi.db"
    return url


database_url = resolve_database_url(get_settings().database_url)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

if database_url.startswith("sqlite"):
    db_path = database_url.replace("sqlite:///", "", 1)
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(database_url, connect_args=connect_args)


def _sqlite_column_type(table: str, column: str) -> str | None:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return None
    for col in insp.get_columns(table):
        if col["name"] == column:
            return str(col["type"]).upper()
    return None


def _reports_unit_nullable() -> bool | None:
    """None = brak tabeli; True/False = nullable unit_id."""
    insp = inspect(engine)
    if "reports" not in insp.get_table_names():
        return None
    for col in insp.get_columns("reports"):
        if col["name"] == "unit_id":
            return bool(col.get("nullable", True))
    return None


def _rebuild_legacy_uuid_tables() -> None:
    """
    Po merge backendów `create_all` nie zmienia istniejących tabel.
    Stare `reports` / `project_proposals` miały INTEGER id — nowe modele UUID.
    Dodatkowo `reports.unit_id` musi być nullable (sprawy bez pewnego dopasowania jednostki).
    """
    if not database_url.startswith("sqlite"):
        return

    to_drop: list[str] = []
    for table in ("reports", "project_proposals"):
        col_type = _sqlite_column_type(table, "id")
        if col_type is None:
            continue
        if "INT" in col_type and "CHAR" not in col_type:
            to_drop.append(table)

    unit_nullable = _reports_unit_nullable()
    if unit_nullable is False and "reports" not in to_drop:
        to_drop.append("reports")

    if not to_drop:
        return

    with engine.begin() as conn:
        for table in to_drop:
            count = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar() or 0
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}"'))
            logger.warning(
                "Przebudowano tabelę %s (schema sync) — usunięto %s wierszy", table, count
            )


def _add_missing_columns() -> None:
    """`create_all` nie dodaje kolumn do istniejących tabel — dopisz nowe, opcjonalne."""
    added = {
        "actualproject": ("source_url", "video_url", "folder_url"),
        "proposalofnewproject": ("essence", "audience", "stage", "canvas"),
        "user": ("sector", "organization", "mentor_bio"),
    }
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, columns in added.items():
            existing = {col["name"] for col in insp.get_columns(table)}
            for column in columns:
                if column not in existing:
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" VARCHAR'))
                    logger.info("Dodano kolumnę %s.%s", table, column)


def create_db_and_tables():
    _rebuild_legacy_uuid_tables()
    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
