import time

from fastapi import FastAPI, Request
from sqlmodel import Session

from .config import get_settings
from .dependencies.db import create_db_and_tables, database_url, engine
from .dependencies.logger import get_logger, setup_logging
from .routes import (
    admin,
    auth,
    categories,
    chat,
    communication,
    ideas,
    knowledge,
    llm,
    projects,
    reports,
    testing,
    units,
    users,
)
from .seed import seed_admin_user, seed_innovation_library, seed_knowledge_resources

setup_logging()
logger = get_logger(__name__)

# Powyżej tego czasu żądanie trafia do logów jako ostrzeżenie.
SLOW_REQUEST_S = 5.0

app = FastAPI()


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "%s %s — nieobsłużony wyjątek", request.method, request.url.path
        )
        raise
    elapsed = time.perf_counter() - start
    if response.status_code >= 500:
        logger.warning(
            "%s %s → %s (%.2fs)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
    elif elapsed > SLOW_REQUEST_S:
        logger.warning(
            "%s %s → %s wolne żądanie (%.2fs)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
    return response


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(units.router)
app.include_router(categories.router)
app.include_router(chat.router)
app.include_router(knowledge.router)
app.include_router(ideas.router)
app.include_router(testing.router)
app.include_router(communication.router)
app.include_router(projects.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(llm.router)  # legacy


@app.on_event("startup")
async def on_startup():
    settings = get_settings()
    logger.info("Start API — baza: %s", database_url.split("://", 1)[0])
    if settings.secret_key == "dev-secret-change-me":
        logger.warning("SECRET_KEY ma wartość domyślną — ustaw własny przed wdrożeniem")
    create_db_and_tables()
    with Session(engine) as session:
        seed_admin_user(session)
        seed_knowledge_resources(session)
        seed_innovation_library(session)
    logger.info("API gotowe")


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
