"""LEGACY — klient LLM z poprzedniej wersji backendu; używa go tylko `routes/llm.py`."""

from app.llm.client import LLMClient, get_llm_client

__all__ = ["LLMClient", "get_llm_client"]
