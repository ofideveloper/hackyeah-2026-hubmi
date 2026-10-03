from fastapi import FastAPI

from .dependencies.db import create_db_and_tables
from .routes import auth, categories, chat, projects, users

app = FastAPI()

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(users.router)


@app.on_event("startup")
async def on_startup():
    create_db_and_tables()


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
