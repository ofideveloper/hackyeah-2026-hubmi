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

    parts = (settings.admin_full_name or "HubMI Admin").strip().split(None, 1)
    admin = User(
        email=settings.admin_email.lower(),
        hashed_password=hash_password(settings.admin_password),
        name=parts[0] if parts else "Admin",
        surname=parts[1] if len(parts) > 1 else "HubMI",
        phone_number=None,
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    admin.sync_full_name()
    db.add(admin)
    db.commit()
