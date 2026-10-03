import enum
import uuid
from datetime import datetime

from pydantic import EmailStr, computed_field
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

    __tablename__ = "unit_projects"

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

    __tablename__ = "project_proposals"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    suggested_unit_id: uuid.UUID | None = Field(
        default=None, foreign_key="organizationalunit.id", index=True
    )
    name: str = Field(max_length=255, index=True)
    description: str = Field(sa_type=Text)
    status: ProjectProposalStatus = Field(default=ProjectProposalStatus.NEW, index=True)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


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
    """Sprawa mieszkańca — status zmienia admin."""

    __tablename__ = "reports"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    unit_id: uuid.UUID = Field(foreign_key="organizationalunit.id", index=True)
    kind: ReportKind = Field(index=True)
    status: ReportStatus = Field(default=ReportStatus.NEW, index=True)
    title: str = Field(max_length=255)
    description: str = Field(sa_type=Text)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ReportCreate(SQLModel):
    unit_id: uuid.UUID
    kind: ReportKind
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2)
    author_id: uuid.UUID | None = None


class ReportStatusUpdate(SQLModel):
    status: ReportStatus


class ReportPublic(SQLModel):
    id: uuid.UUID
    author_id: uuid.UUID
    unit_id: uuid.UUID
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
