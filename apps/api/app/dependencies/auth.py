import hashlib
import hmac
import os
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlmodel import Session, select

from ..config import get_settings
from ..models import User
from .db import SessionDep

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        salt_hex, digest_hex = hashed_password.split("$")
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(digest_hex)
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(digest, expected)


def get_user(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()


def authenticate_user(session: Session, email: str, password: str) -> User | None:
    user = get_user(session, email)
    if user is None or not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(user: User) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user.email, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except InvalidTokenError as exc:
        raise credentials_exception from exc
    email = payload.get("sub")
    user = get_user(session, email) if isinstance(email, str) else None
    if user is None:
        raise credentials_exception
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]
