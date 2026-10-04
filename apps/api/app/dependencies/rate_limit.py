"""Limit wywołań modelu — chroni koszt LLM przed nadużyciem."""

import time
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from ..config import get_settings
from ..models import RateHit, User
from .auth import CurrentUserDep, OptionalUserDep
from .db import SessionDep
from .logger import get_logger

logger = get_logger(__name__)

# BFF przekazuje adres przeglądarki w tym nagłówku; samo API widzi tylko BFF.
CLIENT_IP_HEADER = "x-client-ip"


def client_ip(request: Request) -> str:
    forwarded = request.headers.get(CLIENT_IP_HEADER, "").split(",")[0].strip()
    if forwarded:
        return forwarded[:64]
    return request.client.host if request.client else "unknown"


def hit(session: Session, key: str, limit: int) -> None:
    """Zlicza żądanie; po przekroczeniu `limit` w bieżącym oknie zwraca 429."""
    window_s = get_settings().ai_rate_window_s
    now = int(time.time())
    window = now - now % window_s
    row = session.get(RateHit, key)
    if row is None:
        row = RateHit(key=key, window_start=window, count=0)
    elif row.window_start != window:
        row.window_start, row.count = window, 0
    if row.count >= limit:
        logger.warning("Limit żądań przekroczony: %s", key.split(":", 1)[0])
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Za dużo zapytań w krótkim czasie — spróbuj ponownie za kilka minut.",
            headers={"Retry-After": str(window + window_s - now)},
        )
    row.count += 1
    session.add(row)
    session.commit()


async def limit_chat(request: Request, user: OptionalUserDep, session: SessionDep) -> None:
    settings = get_settings()
    if user is not None:
        hit(session, f"chat:u:{user.id}", settings.chat_rate_user)
    else:
        hit(session, f"chat:ip:{client_ip(request)}", settings.chat_rate_guest)


async def limit_ai(user: CurrentUserDep, session: SessionDep) -> User:
    """Asystenci dla zalogowanych (kreator, Middleman) — wspólny licznik na osobę."""
    hit(session, f"ai:u:{user.id}", get_settings().ai_rate_user)
    return user


ChatLimitDep = Annotated[None, Depends(limit_chat)]
AiUserDep = Annotated[User, Depends(limit_ai)]
