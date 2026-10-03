import json
import os
import time
import uuid

import httpx
from dotenv import find_dotenv, load_dotenv
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.dependencies.db import SessionDep
from app.models import ActualProject, ChatHistory

load_dotenv(find_dotenv(usecwd=True))

router = APIRouter(prefix="/chat", tags=["chat"])

# Dowolne API zgodne z OpenAI (chat/completions). Domyślnie DeepSeek przez OpenRouter;
# bezpośrednio: LLM_BASE_URL=https://api.deepseek.com, LLM_MODEL=deepseek-chat.
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3.8-27b:free")


class LLMError(Exception):
    pass


async def ask_llm(messages: list[dict[str, str]]) -> str:
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
                json={"model": LLM_MODEL, "messages": messages},
            )
    except httpx.HTTPError as exc:
        raise LLMError(
            f"brak połączenia z {LLM_BASE_URL} ({type(exc).__name__})"
        ) from exc

    try:
        data = response.json()
    except ValueError:
        data = {}
    # OpenRouter potrafi zwrócić błąd dostawcy w body przy statusie 200.
    error = data.get("error") if isinstance(data, dict) else None
    if response.is_error or error:
        detail = error.get("message") if isinstance(error, dict) else error
        raise LLMError(str(detail or f"HTTP {response.status_code}"))
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMError("nieoczekiwany format odpowiedzi") from exc


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    # Brak chat_id = pierwsza wiadomość, zakładamy nową rozmowę.
    chat_id: uuid.UUID | None = None


class ChatReply(BaseModel):
    reply: str
    chat_id: uuid.UUID


PROMPT = """Jesteś asystentem AI. Twoim zadaniem jest wypisać listę projektów, które mogą pomóc. Prowadzisz jedną rozmowę z użytkownikiem — odpowiadając na kolejne wiadomości, uwzględniaj wszystko, co padło wcześniej. Oto lista aktualnych projektów:
{projects}"""


def build_system_prompt(session: Session) -> str:
    actual_projects = session.exec(select(ActualProject)).all()
    projects = "\n\n".join(
        f"### {project.name}\n{project.description}" for project in actual_projects
    )
    return PROMPT.format(projects=projects)


async def continue_conversation(
    session: Session, chat: ChatHistory | None, message: str
) -> tuple[ChatHistory, str]:
    """Dopisuje wiadomość usera do rozmowy i zwraca odpowiedź modelu.

    Model dostaje całą dotychczasową rozmowę (od pierwszego prompta), więc
    odpowiada w ramach jednego kontekstu. Rozmowa jest zapisywana dopiero po
    udanej odpowiedzi — nieudaną wiadomość można wysłać ponownie.
    """
    turns: list[dict[str, str]] = json.loads(chat.all_conversation) if chat else []
    turns.append({"role": "user", "text": message})

    reply = await ask_llm(
        [{"role": "system", "content": build_system_prompt(session)}]
        + [{"role": turn["role"], "content": turn["text"]} for turn in turns]
    )
    turns.append({"role": "assistant", "text": reply})

    if chat is None:
        chat = ChatHistory(first_question=message, all_conversation="")
    chat.all_conversation = json.dumps(turns, ensure_ascii=False)
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat, reply


@router.post("/", response_model=ChatReply)
async def chat(payload: ChatRequest, session: SessionDep):
    start = time.time()
    history = None
    if payload.chat_id is not None:
        history = session.get(ChatHistory, payload.chat_id)
        if history is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rozmowa nie istnieje",
            )

    try:
        history, reply = await continue_conversation(session, history, payload.message)
        end = time.time()
        print(f"Chat response time: {end - start:.2f} seconds")
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Model nie odpowiedział: {exc}",
        ) from exc

    return ChatReply(reply=reply, chat_id=history.id)
