import enum
import uuid
from datetime import datetime

from pydantic import EmailStr
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


class CategoriesOfProjects(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str


class ActualProject(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    category_id: uuid.UUID = Field(foreign_key="categoriesofprojects.id")
    name: str
    description: str = Field(sa_type=Text)


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
