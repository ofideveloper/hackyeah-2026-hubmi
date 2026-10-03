from fastapi import APIRouter, Depends
from sqlmodel import col, select

from ..dependencies.auth import get_current_user
from ..dependencies.db import SessionDep
from ..models import OrganizationalUnit, OrganizationalUnitPublic

router = APIRouter(
    prefix="/units",
    tags=["units"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[OrganizationalUnitPublic])
async def list_units(session: SessionDep) -> list[OrganizationalUnit]:
    return list(
        session.exec(select(OrganizationalUnit).order_by(col(OrganizationalUnit.name))).all()
    )
