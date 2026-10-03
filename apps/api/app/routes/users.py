from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from ..dependencies.auth import CurrentUserDep
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
