from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class ReportKind(str, Enum):
    PROBLEM = "problem"
    EVENT = "wydarzenie"
    INFO = "informacja"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default=UserRole.USER.value, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    reports: Mapped[list["Report"]] = relationship(back_populates="author")

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN.value


class OrganizationalUnit(Base):
    """Jednostka organizacyjna z zakresem terenu i kompetencjami."""

    __tablename__ = "organizational_units"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    territory: Mapped[str] = mapped_column(Text)
    competencies: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    reports: Mapped[list["Report"]] = relationship(back_populates="unit")
    projects: Mapped[list["Project"]] = relationship(back_populates="unit")


class Project(Base):
    """Projekt jednostki — opis pod przyszłe dopasowanie osób (bez czatu w MVP)."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("organizational_units.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    unit: Mapped[OrganizationalUnit] = relationship(back_populates="projects")


class Report(Base):
    """Zgłoszenie mieszkańca skierowane do jednostki wg odpowiedzialności."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("organizational_units.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    author: Mapped[User] = relationship(back_populates="reports")
    unit: Mapped[OrganizationalUnit] = relationship(back_populates="reports")
