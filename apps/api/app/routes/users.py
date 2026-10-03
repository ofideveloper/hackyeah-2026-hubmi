from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from ..dependencies.auth import CurrentUserDep, hash_password, verify_password
from ..dependencies.db import SessionDep
from ..dependencies.logger import get_logger
from ..models import MENTOR_BIO_MAX, ORGANIZATION_MAX, SectorEnum, User, UserPublic

router = APIRouter(prefix="/users", tags=["users"])
logger = get_logger(__name__)


class ProfileInput(BaseModel):
    """Profil platformy komunikacji — sektor i organizacja, a u mentora także opis."""

    model_config = ConfigDict(extra="forbid")

    sector: SectorEnum | None = None
    organization: str = Field(default="", max_length=ORGANIZATION_MAX)
    mentor_bio: str = Field(default="", max_length=MENTOR_BIO_MAX)


class PasswordChangeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


@router.patch("/me", response_model=UserPublic)
async def update_my_profile(
    payload: ProfileInput, user: CurrentUserDep, session: SessionDep
) -> User:
    user.sector = payload.sector
    user.organization = payload.organization.strip() or None
    user.mentor_bio = payload.mentor_bio.strip() or None
    session.add(user)
    session.commit()
    session.refresh(user)
    logger.info("Zaktualizowano profil użytkownika %s", user.id)
    return user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    payload: PasswordChangeInput, user: CurrentUserDep, session: SessionDep
) -> None:
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowe obecne hasło",
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nowe hasło musi różnić się od obecnego",
        )
    user.hashed_password = hash_password(payload.new_password)
    session.add(user)
    session.commit()
    logger.info("Zmieniono hasło użytkownika %s", user.id)
