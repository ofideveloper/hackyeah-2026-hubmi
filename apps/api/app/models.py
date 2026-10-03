import enum
import re
import uuid
from datetime import datetime

from pydantic import EmailStr, computed_field, field_validator
from sqlalchemy import Text
from sqlmodel import Field, SQLModel


class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"
    SPECIALIST = "specialist"


class StatusEnum(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReportKind(str, enum.Enum):
    PROBLEM = "problem"
    EVENT = "wydarzenie"
    INFO = "informacja"


class ReportStatus(str, enum.Enum):
    NEW = "nowe"
    IN_PROGRESS = "w_toku"
    DONE = "zakonczone"


class ProjectProposalStatus(str, enum.Enum):
    NEW = "nowe"
    ACCEPTED = "zaakceptowane"
    REJECTED = "odrzucone"


PHONE_NUMBER_RE = re.compile(r"^\+?\d(?:[ \-]?\d){8,14}$")


class UserBase(SQLModel):
    email: EmailStr = Field(index=True, unique=True)
    name: str
    surname: str
    phone_number: str | None = None


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    role: RoleEnum = Field(default=RoleEnum.USER)


class UserCreate(UserBase):
    password: str = Field(min_length=8)

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if not PHONE_NUMBER_RE.fullmatch(value):
            raise ValueError("Nieprawidłowy numer telefonu")
        return value


class UserPublic(UserBase):
    id: uuid.UUID
    role: RoleEnum

    @computed_field
    @property
    def full_name(self) -> str | None:
        joined = f"{self.name} {self.surname}".strip()
        return joined or None


class AdminStats(SQLModel):
    users_total: int
    users_active: int
    admins_total: int
    units_total: int = 0
    reports_total: int = 0
    projects_total: int = 0


class OrganizationalUnitBase(SQLModel):
    name: str = Field(min_length=2, max_length=255, index=True, unique=True)
    territory: str = Field(sa_type=Text)
    competencies: str = Field(sa_type=Text)


class OrganizationalUnit(OrganizationalUnitBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class OrganizationalUnitCreate(OrganizationalUnitBase):
    pass


class OrganizationalUnitUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    territory: str | None = None
    competencies: str | None = None


class OrganizationalUnitPublic(OrganizationalUnitBase):
    id: uuid.UUID
    created_at: str


class UnitProjectBase(SQLModel):
    unit_id: uuid.UUID = Field(foreign_key="organizationalunit.id", index=True)
    name: str = Field(min_length=2, max_length=255, index=True)
    description: str = Field(sa_type=Text)


class UnitProject(UnitProjectBase, table=True):
    """Projekt jednostki (panel admina / matching) — osobno od katalogu ActualProject."""

    __tablename__: str = "unit_projects"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class UnitProjectCreate(SQLModel):
    unit_id: uuid.UUID
    name: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2)


class UnitProjectUpdate(SQLModel):
    unit_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, min_length=2)


class UnitProjectPublic(SQLModel):
    id: uuid.UUID
    unit_id: uuid.UUID
    unit_name: str | None = None
    name: str
    description: str
    created_at: str


class ProjectProposal(SQLModel, table=True):
    """Propozycja projektu z czatu — kolejka admina."""

    __tablename__: str = "project_proposals"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    suggested_unit_id: uuid.UUID | None = Field(
        default=None, foreign_key="organizationalunit.id", index=True
    )
    name: str = Field(max_length=255, index=True)
    description: str = Field(sa_type=Text)
    status: ProjectProposalStatus = Field(default=ProjectProposalStatus.NEW, index=True)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ProjectProposalCreate(SQLModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2, max_length=5000)


class ProjectProposalAccept(SQLModel):
    unit_id: uuid.UUID
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, min_length=2)


class ProjectProposalPublic(SQLModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author_email: str | None = None
    author_name: str | None = None
    suggested_unit_id: uuid.UUID | None = None
    suggested_unit_name: str | None = None
    name: str
    description: str
    status: ProjectProposalStatus
    created_at: str


class Report(SQLModel, table=True):
    """Sprawa mieszkańca — status zmienia admin. Jednostka opcjonalna (dopasowanie kompetencji)."""

    __tablename__: str = "reports"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    unit_id: uuid.UUID | None = Field(
        default=None, foreign_key="organizationalunit.id", index=True
    )
    kind: ReportKind = Field(index=True)
    status: ReportStatus = Field(default=ReportStatus.NEW, index=True)
    title: str = Field(max_length=255)
    description: str = Field(sa_type=Text)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ReportCreate(SQLModel):
    unit_id: uuid.UUID | None = None
    kind: ReportKind
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2)
    author_id: uuid.UUID | None = None


class ReportStatusUpdate(SQLModel):
    status: ReportStatus | None = None
    unit_id: uuid.UUID | None = None


class ReportPublic(SQLModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author_email: str | None = None
    author_name: str | None = None
    unit_id: uuid.UUID | None = None
    unit_name: str | None = None
    kind: ReportKind
    status: ReportStatus
    title: str
    description: str
    created_at: str


class CategoriesOfProjectsBase(SQLModel):
    name: str = Field(min_length=1)


class CategoriesOfProjects(CategoriesOfProjectsBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class CategoriesOfProjectsCreate(CategoriesOfProjectsBase):
    pass


class ActualProjectBase(SQLModel):
    category_id: uuid.UUID = Field(foreign_key="categoriesofprojects.id")
    name: str = Field(min_length=1)
    description: str = Field(sa_type=Text)
    # Uzupełniane przez scraper: strona źródłowa, film i folder (PDF) o innowacji.
    source_url: str | None = None
    video_url: str | None = None
    folder_url: str | None = None


class ActualProject(ActualProjectBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class ActualProjectCreate(ActualProjectBase):
    pass


class ProposalOfNewProject(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    category_id: uuid.UUID = Field(foreign_key="categoriesofprojects.id")
    name: str
    description: str = Field(sa_type=Text)
    author_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    modified_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: StatusEnum = Field(default=StatusEnum.PENDING)
    chat_id: uuid.UUID | None = Field(foreign_key="chathistory.id", default=None)


class ProjectBenefices(SQLModel, table=True):
    project_id: uuid.UUID = Field(foreign_key="actualproject.id", primary_key=True)
    benefice_id: uuid.UUID = Field(foreign_key="benefice.id", primary_key=True)


class Benefice(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str


class ChatHistory(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    first_question: str = Field(sa_type=Text)
    all_conversation: str = Field(sa_type=Text)


class KnowledgeResourceKind(str, enum.Enum):
    CHALLENGE = "wyzwanie"  # raporty, Mapa Wyzwań Społecznych, diagnozy
    MATERIAL = "material"  # materiały edukacyjne, publikacje, filmy


class KnowledgeResourceBase(SQLModel):
    kind: KnowledgeResourceKind = Field(index=True)
    title: str = Field(min_length=2, max_length=255)
    summary: str = Field(default="", max_length=2000, sa_type=Text)
    # Etykieta formy, np. „Raport”, „Film”, „Poradnik”.
    format: str = Field(default="", max_length=40)
    url: str | None = Field(default=None, max_length=1000)
    category_id: uuid.UUID | None = Field(
        default=None, foreign_key="categoriesofprojects.id", index=True
    )

    @field_validator("url")
    @classmethod
    def _http_url_only(cls, value: str | None) -> str | None:
        # Link trafia do href na publicznej stronie — inne schematy (javascript:) to XSS.
        value = (value or "").strip() or None
        if value is not None and not value.lower().startswith(("https://", "http://")):
            raise ValueError("Adres musi zaczynać się od https:// lub http://")
        return value


class KnowledgeResource(KnowledgeResourceBase, table=True):
    """Zasobnik wiedzy — treści redagowane przez admina (wyzwania, materiały)."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class KnowledgeResourceCreate(KnowledgeResourceBase):
    pass


class NeedSignal(SQLModel, table=True):
    """Potrzeba zgłoszona w czacie — surowiec do trendów w panelu admina.

    `category_id` to obszar dopasowanego projektu; `None` oznacza potrzebę,
    na którą baza nie miała odpowiedzi (wtedy `summary` niesie jej opis).
    """

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat(), index=True)
    chat_id: uuid.UUID | None = Field(default=None, foreign_key="chathistory.id", index=True)
    category_id: uuid.UUID | None = Field(
        default=None, foreign_key="categoriesofprojects.id", index=True
    )
    summary: str = Field(default="", sa_type=Text)
