from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.migrate import ensure_sqlite_schema
from app.routers import admin, auth, chat, llm, project_proposals, projects, reports, units
from app.seed import seed_admin_user

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema(engine)
    db = SessionLocal()
    try:
        seed_admin_user(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="HubMI API",
    description="FastAPI backend for HackYeah HubMI monorepo",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(units.router)
app.include_router(projects.router)
app.include_router(project_proposals.router)
app.include_router(reports.router)
app.include_router(chat.router)
app.include_router(llm.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
