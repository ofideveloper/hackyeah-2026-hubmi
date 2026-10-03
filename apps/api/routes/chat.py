import os
import time

from api.dependencies.db import SessionDep
from api.models import ActualProject
from dotenv import find_dotenv, load_dotenv
from fastapi import APIRouter, HTTPException, status
from google import genai
from google.genai import errors
from pydantic import BaseModel, Field
from sqlmodel import select

load_dotenv(find_dotenv(usecwd=True))

router = APIRouter(prefix="/chat", tags=["chat"])

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)


class ChatReply(BaseModel):
    reply: str


PROMPT = """Jesteś asystentem AI. Twoim zadaniem jest wypisać listę projektów, które mogą pomóc. Oto lista aktualnych projektów: {projects}. {user_message}"""


@router.post("/", response_model=ChatReply)
async def chat(payload: ChatRequest, session: SessionDep):
    start = time.time()
    actual_projects = session.exec(select(ActualProject)).all()
    prompt = PROMPT.format(
        projects=f"{actual_projects}",
        user_message=payload.message,
    )

    try:
        print(f"Sending request to Gemini API with message: {prompt}")
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=[
                prompt,
            ],
        )

        end = time.time()
        print(f"Chat response time: {end - start:.2f} seconds")
    except errors.APIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Model nie odpowiedział: {exc.message}",
        ) from exc

    return ChatReply(reply=response.text or "")
