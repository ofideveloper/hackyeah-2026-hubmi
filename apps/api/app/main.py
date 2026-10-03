from fastapi import FastAPI
from sqlmodel import Session

from .dependencies.db import create_db_and_tables, engine
from .routes import admin, auth, categories, chat, llm, projects, reports, units, users
from .seed import seed_admin_user

app = FastAPI()

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(units.router)
app.include_router(categories.router)
app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(llm.router)  # legacy


@app.on_event("startup")
async def on_startup():
    create_db_and_tables()
    with Session(engine) as session:
        seed_admin_user(session)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
