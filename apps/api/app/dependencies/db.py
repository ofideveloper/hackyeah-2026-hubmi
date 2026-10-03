import os
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel

from ..config import get_settings


def resolve_database_url(url: str) -> str:
    """On Vercel the filesystem is ephemeral; keep SQLite under /tmp unless overridden."""
    if os.environ.get("VERCEL") and url.startswith("sqlite") and "/tmp/" not in url:
        return "sqlite:////tmp/hubmi.db"
    return url


database_url = resolve_database_url(get_settings().database_url)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

if database_url.startswith("sqlite"):
    db_path = database_url.replace("sqlite:///", "", 1)
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(database_url, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
