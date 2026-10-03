from sqlalchemy.orm import Session

from app.auth import get_user_by_email, hash_password
from app.config import get_settings
from app.models import User, UserRole


def seed_admin_user(db: Session) -> None:
    settings = get_settings()
    existing = get_user_by_email(db, settings.admin_email.lower())
    if existing:
        if existing.role != UserRole.ADMIN.value:
            existing.role = UserRole.ADMIN.value
            existing.is_active = True
            db.commit()
        return

    admin = User(
        email=settings.admin_email.lower(),
        hashed_password=hash_password(settings.admin_password),
        full_name=settings.admin_full_name,
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    db.add(admin)
    db.commit()
