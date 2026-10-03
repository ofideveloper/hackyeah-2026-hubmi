from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./data/hubmi.db"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"
    cors_origins: str = "http://localhost:3000"
    admin_email: str = "admin@malohub.dev"
    admin_password: str = "admin12345"
    admin_full_name: str = "MaloHUB Admin"
    log_level: str = "INFO"

    # LLM: `fake` | `openai` | `gemini`
    llm_provider: str = "fake"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    # Opcjonalnie nadpisuje URL (np. OpenRouter). Puste = z providera.
    llm_base_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
