"""Publiczny bypass LLM — ten sam kontrakt, którego używa `/chat`."""

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.llm import get_llm_client
from app.models import User
from app.schemas import LLMChatRequest, LLMChatResponse

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/chat", response_model=LLMChatResponse)
def llm_chat(
    payload: LLMChatRequest,
    _: User = Depends(get_current_user),
) -> LLMChatResponse:
    """
    Fake/real LLM gateway.

    Body jak u dostawców chat:
    `{ "messages": [{ "role": "user"|"system"|"assistant", "content": "..." }], "model": "..." }`
    """
    client = get_llm_client()
    return client.chat(payload)


@router.get("/health")
def llm_health(_: User = Depends(get_current_user)) -> dict[str, str]:
    client = get_llm_client()
    return {"status": "ok", "provider": client.provider}
