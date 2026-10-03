from sqlmodel import Session

from .config import get_settings
from .dependencies.auth import get_user, hash_password
from .models import RoleEnum, User


def seed_admin_user(session: Session) -> None:
    settings = get_settings()
    email = settings.admin_email.lower()
    existing = get_user(session, email)
    if existing is not None:
        if existing.role != RoleEnum.ADMIN:
            existing.role = RoleEnum.ADMIN
            session.add(existing)
            session.commit()
        return

    parts = (settings.admin_full_name or "MaloHUB Admin").strip().split(None, 1)
    admin = User(
        email=email,
        hashed_password=hash_password(settings.admin_password),
        name=parts[0] if parts else "Admin",
        surname=parts[1] if len(parts) > 1 else "MaloHUB",
        phone_number=None,
        role=RoleEnum.ADMIN,
    )
    session.add(admin)
    session.commit()
