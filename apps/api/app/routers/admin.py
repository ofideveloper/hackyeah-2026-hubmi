from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_admin
from app.database import get_db
from app.models import User, UserRole
from app.schemas import AdminStats, UserPublic

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def stats(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminStats:
    users_total = db.scalar(select(func.count()).select_from(User)) or 0
    users_active = (
        db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0
    )
    admins_total = (
        db.scalar(
            select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)
        )
        or 0
    )
    return AdminStats(
        users_total=users_total,
        users_active=users_active,
        admins_total=admins_total,
    )


@router.get("/users", response_model=list[UserPublic])
def list_users(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())
