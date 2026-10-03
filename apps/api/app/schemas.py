"""LEGACY — kontrakt LLM dla `app/llm/` i `routes/llm.py`. Nowe schematy → `models.py`."""

from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=16000)


class LLMChatRequest(BaseModel):
    messages: list[LLMMessage] = Field(min_length=1)
    model: str | None = Field(default=None, max_length=128)


class LLMChatResponse(BaseModel):
    id: str
    model: str
    provider: str
    content: str
