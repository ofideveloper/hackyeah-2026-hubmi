import hashlib
import hmac
import os
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

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
    # Same as the "simple OAuth2" tutorial: the token is just the username (email).
    # Replace with a signed JWT before this goes anywhere real.
    return user.email


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep
) -> User:
    user = get_user(session, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]
