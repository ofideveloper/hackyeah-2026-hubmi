from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=255)
    surname: str = Field(min_length=1, max_length=255)
    phone_number: str | None = Field(default=None, max_length=32)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    surname: str
    phone_number: str | None
    full_name: str | None = None
    role: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None


class AdminStats(BaseModel):
    users_total: int
    users_active: int
    admins_total: int
    units_total: int = 0
    reports_total: int = 0
    projects_total: int = 0


class UnitCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    territory: str = Field(min_length=2, max_length=2000)
    competencies: str = Field(min_length=2, max_length=2000)


class UnitPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    territory: str
    competencies: str
    created_at: datetime


class ProjectCreate(BaseModel):
    unit_id: int
    name: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2, max_length=5000)


class ProjectUpdate(BaseModel):
    unit_id: int | None = None
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, min_length=2, max_length=5000)


class ProjectPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    unit_id: int
    unit_name: str | None = None
    name: str
    description: str
    created_at: datetime


class ChatHistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=40)


class ProjectProposalPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int
    author_email: str | None = None
    author_name: str | None = None
    suggested_unit_id: int | None = None
    suggested_unit_name: str | None = None
    name: str
    description: str
    status: str
    created_at: datetime


class ProjectProposalAccept(BaseModel):
    unit_id: int
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, min_length=2, max_length=5000)


class ChatResponse(BaseModel):
    reply: str
    suggested_projects: list[ProjectPublic] = []
    project_proposal: ProjectProposalPublic | None = None
    location_request: str | None = Field(
        default=None,
        pattern="^(area|gps)$",
        description="Prośba o lokalizację: area = miejsce zdarzenia, gps = aktualna pozycja",
    )


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


class ReportCreate(BaseModel):
    """Tworzenie sprawy — na razie API (AI / system); nie UI mieszkańca."""

    unit_id: int
    kind: str = Field(pattern="^(problem|wydarzenie|informacja)$")
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2, max_length=5000)
    author_id: int | None = None


class ReportStatusUpdate(BaseModel):
    status: str = Field(pattern="^(nowe|w_toku|zakonczone)$")


class ReportPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int
    unit_id: int
    unit_name: str | None = None
    kind: str
    status: str = "nowe"
    title: str
    description: str
    created_at: datetime
