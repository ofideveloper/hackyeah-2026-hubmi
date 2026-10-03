import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..dependencies.auth import get_current_user
from ..dependencies.db import SessionDep
from ..models import (
    ActualProject,
    CategoriesOfProjects,
    CategoriesOfProjectsCreate,
    ProposalOfNewProject,
)

router = APIRouter(
    prefix="/categories",
    tags=["categories"],
    dependencies=[Depends(get_current_user)],
)


def get_category_or_404(session: Session, category_id: uuid.UUID) -> CategoriesOfProjects:
    category = session.get(CategoriesOfProjects, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategoria nie istnieje",
        )
    return category


def ensure_name_free(session: Session, name: str, except_id: uuid.UUID | None = None):
    existing = session.exec(
        select(CategoriesOfProjects).where(CategoriesOfProjects.name == name)
    ).first()
    if existing is not None and existing.id != except_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kategoria o tej nazwie już istnieje",
        )


@router.get("", response_model=list[CategoriesOfProjects])
async def list_categories(session: SessionDep):
    return session.exec(
        select(CategoriesOfProjects).order_by(CategoriesOfProjects.name)
    ).all()


@router.get("/{category_id}", response_model=CategoriesOfProjects)
async def get_category(category_id: uuid.UUID, session: SessionDep):
    return get_category_or_404(session, category_id)


@router.post(
    "", response_model=CategoriesOfProjects, status_code=status.HTTP_201_CREATED
)
async def create_category(payload: CategoriesOfProjectsCreate, session: SessionDep):
    ensure_name_free(session, payload.name)
    category = CategoriesOfProjects.model_validate(payload)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoriesOfProjects)
async def update_category(
    category_id: uuid.UUID, payload: CategoriesOfProjectsCreate, session: SessionDep
):
    category = get_category_or_404(session, category_id)
    ensure_name_free(session, payload.name, except_id=category_id)
    category.name = payload.name
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: uuid.UUID, session: SessionDep):
    category = get_category_or_404(session, category_id)
    for model in (ActualProject, ProposalOfNewProject):
        in_use = session.exec(
            select(model).where(model.category_id == category_id)
        ).first()
        if in_use is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Kategoria jest używana przez projekty lub propozycje",
            )
    session.delete(category)
    session.commit()
