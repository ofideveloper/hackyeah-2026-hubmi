from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..dependencies.auth import (
    CurrentUserDep,
    authenticate_user,
    create_access_token,
    get_user,
    hash_password,
)
from ..dependencies.db import SessionDep
from ..models import User, UserCreate, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, session: SessionDep):
    if get_user(session, payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto z tym adresem email już istnieje",
        )
    user = User(
        **payload.model_dump(exclude={"password"}),
        hashed_password=hash_password(payload.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/login")
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep
):
    user = authenticate_user(session, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy email lub hasło",
        )
    return {"access_token": create_access_token(user), "token_type": "bearer"}


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: CurrentUserDep):
    return current_user
