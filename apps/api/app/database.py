import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()


def resolve_database_url(url: str) -> str:
    """On Vercel the filesystem is ephemeral; keep SQLite under /tmp unless overridden."""
    if os.environ.get("VERCEL") and url.startswith("sqlite") and "/tmp/" not in url:
        return "sqlite:////tmp/hubmi.db"
    return url


database_url = resolve_database_url(settings.database_url)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

if database_url.startswith("sqlite"):
    db_path = database_url.replace("sqlite:///", "", 1)
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
