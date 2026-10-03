"""LEGACY — bypass LLM z poprzedniej wersji backendu (`app/llm/`).

Zostawiony do czasu przepięcia czatu; nowy czat to `routes/chat.py`.
Nie rozwijaj tego modułu.
"""

from fastapi import APIRouter

from ..dependencies.auth import CurrentUserDep
from ..llm import get_llm_client
from ..schemas import LLMChatRequest, LLMChatResponse

router = APIRouter(prefix="/llm", tags=["llm (legacy)"], deprecated=True)


@router.post("/chat", response_model=LLMChatResponse)
def llm_chat(payload: LLMChatRequest, _: CurrentUserDep) -> LLMChatResponse:
    """
    Fake/real LLM gateway.

    Body jak u dostawców chat:
    `{ "messages": [{ "role": "user"|"system"|"assistant", "content": "..." }], "model": "..." }`
    """
    client = get_llm_client()
    return client.chat(payload)


@router.get("/health")
def llm_health(_: CurrentUserDep) -> dict[str, str]:
    client = get_llm_client()
    return {"status": "ok", "provider": client.provider}
