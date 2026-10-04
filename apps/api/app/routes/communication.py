"""Platforma komunikacji — pytania do ROPS, rozmowy z mentorami i ogłoszenia partnerskie.

Wszystkie trzy filary korzystają z jednego modelu: `Conversation` + `Message`.
"""

import uuid
from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlmodel import Session, col, func, or_, select

from ..dependencies.auth import CurrentUserDep, OptionalUserDep
from ..dependencies.db import SessionDep
from ..dependencies.logger import get_logger
from ..models import (
    MESSAGE_BODY_MAX,
    THREAD_SUBJECT_MAX,
    Conversation,
    ConversationKind,
    ConversationStatus,
    ListingKind,
    Message,
    PartnershipListing,
    RoleEnum,
    SectorEnum,
    User,
)
from .ideas import _author_label, _now
from .testing import _full_name

router = APIRouter(tags=["communication"])
logger = get_logger(__name__)

ROPS_LABEL = "Zespół ROPS"
THREAD_MESSAGES_LIMIT = 200
LISTINGS_LIMIT = 200
# Prosty hamulec nadużyć: tyle wiadomości jedna osoba może wysłać w oknie czasu.
THROTTLE_MESSAGES = 20
THROTTLE_WINDOW_S = 60

Side = Literal["author", "recipient"]

# Treść po przycięciu nie może być pusta — same spacje to nie wiadomość.
Body = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MESSAGE_BODY_MAX)
]
Subject = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=THREAD_SUBJECT_MAX)
]


class MentorPublic(BaseModel):
    """Publiczna wizytówka mentora — bez e-maila i telefonu."""

    id: uuid.UUID
    name: str | None = None
    organization: str | None = None
    sector: SectorEnum | None = None
    bio: str | None = None


class ListingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: ListingKind
    title: Subject
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=2, max_length=MESSAGE_BODY_MAX)
    ]
    sought_sector: SectorEnum | None = None


class ListingPublic(BaseModel):
    id: uuid.UUID
    kind: ListingKind
    title: str
    description: str
    sought_sector: SectorEnum | None = None
    author_name: str | None = None
    author_organization: str | None = None
    author_sector: SectorEnum | None = None
    created_at: str
    is_mine: bool = False


class MessageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: Body


class ConversationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # rozmowa partnerska powstaje wyłącznie przez odpowiedź na ogłoszenie
    kind: Literal["pytanie", "mentoring"]
    subject: Subject
    body: Body
    mentor_id: uuid.UUID | None = None


class ConversationStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ConversationStatus


class MessagePublic(BaseModel):
    id: uuid.UUID
    author_name: str | None = None
    is_mine: bool
    body: str
    created_at: str


class ConversationPublic(BaseModel):
    id: uuid.UUID
    kind: ConversationKind
    subject: str
    status: ConversationStatus
    counterpart_name: str | None = None
    counterpart_email: str | None = None  # tylko dla admina w pytaniach do ROPS
    unread: bool
    created_at: str
    last_message_at: str


class ConversationDetail(ConversationPublic):
    messages: list[MessagePublic] = Field(default_factory=list)


def _side(conversation: Conversation, user: User) -> Side | None:
    if conversation.author_id == user.id:
        return "author"
    if conversation.recipient_id == user.id:
        return "recipient"
    # pytanie do ROPS nie ma jednego odbiorcy — odpowiada dowolny admin
    if conversation.kind == ConversationKind.QUESTION and user.role == RoleEnum.ADMIN:
        return "recipient"
    return None


def _own_conversation(
    session: Session, conversation_id: uuid.UUID, user: User
) -> tuple[Conversation, Side]:
    conversation = session.get(Conversation, conversation_id)
    side = _side(conversation, user) if conversation is not None else None
    if conversation is None or side is None:
        # 404 także dla cudzej rozmowy — nie zdradzamy, że istnieje.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak rozmowy")
    return conversation, side


def _is_unread(conversation: Conversation, side: Side) -> bool:
    if conversation.last_author_id is None:
        return False
    from_author = conversation.last_author_id == conversation.author_id
    if side == "author":
        return not from_author and conversation.last_message_at > (
            conversation.author_read_at or ""
        )
    return from_author and conversation.last_message_at > (conversation.recipient_read_at or "")


def _mark_read(conversation: Conversation, side: Side, when: str) -> None:
    if side == "author":
        conversation.author_read_at = when
    else:
        conversation.recipient_read_at = when


def _throttle(session: Session, user: User) -> None:
    since = (datetime.now() - timedelta(seconds=THROTTLE_WINDOW_S)).isoformat()
    recent = session.exec(
        select(func.count())
        .select_from(Message)
        .where(Message.author_id == user.id, Message.created_at > since)
    ).one()
    if recent >= THROTTLE_MESSAGES:
        logger.warning("Limit wiadomości przekroczony przez użytkownika %s", user.id)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Za dużo wiadomości w krótkim czasie — spróbuj za chwilę",
        )


def _add_message(
    session: Session, conversation: Conversation, user: User, side: Side, body: str
) -> None:
    """Dopisuje wiadomość i przesuwa znaczniki rozmowy; zatwierdza wywołujący."""
    now = _now()  # ten sam czas w wiadomości i w rozmowie — na nim opiera się „nieprzeczytane”
    session.add(
        Message(conversation_id=conversation.id, author_id=user.id, body=body, created_at=now)
    )
    conversation.last_message_at = now
    conversation.last_author_id = user.id
    _mark_read(conversation, side, now)
    session.add(conversation)


def _conversation_fields(
    session: Session, conversation: Conversation, user: User, side: Side
) -> dict:
    email = None
    if side == "recipient":
        author = session.get(User, conversation.author_id)
        name = _full_name(author)
        if conversation.kind == ConversationKind.QUESTION and author is not None:
            email = author.email
    elif conversation.kind == ConversationKind.QUESTION:
        name = ROPS_LABEL
    else:
        name = _full_name(
            session.get(User, conversation.recipient_id) if conversation.recipient_id else None
        )
    return dict(
        id=conversation.id,
        kind=conversation.kind,
        subject=conversation.subject,
        status=conversation.status,
        counterpart_name=name,
        counterpart_email=email,
        unread=_is_unread(conversation, side),
        created_at=conversation.created_at,
        last_message_at=conversation.last_message_at,
    )


def _conversation_detail(
    session: Session, conversation: Conversation, user: User, side: Side
) -> ConversationDetail:
    rows = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(col(Message.created_at).desc())
        .limit(THREAD_MESSAGES_LIMIT)
    ).all()
    # pytający widzi odpowiedzi adminów jako zespół, nie jako konkretne osoby
    as_team = conversation.kind == ConversationKind.QUESTION and side == "author"
    authors: dict[uuid.UUID, User | None] = {}
    messages: list[MessagePublic] = []
    for row in reversed(rows):
        if row.author_id not in authors:
            authors[row.author_id] = session.get(User, row.author_id)
        from_team = as_team and row.author_id != conversation.author_id
        messages.append(
            MessagePublic(
                id=row.id,
                author_name=ROPS_LABEL if from_team else _full_name(authors[row.author_id]),
                is_mine=row.author_id == user.id,
                body=row.body,
                created_at=row.created_at,
            )
        )
    return ConversationDetail(
        **_conversation_fields(session, conversation, user, side), messages=messages
    )


def _listing_public(
    session: Session, listing: PartnershipListing, user: User | None
) -> ListingPublic:
    author = session.get(User, listing.author_id)
    return ListingPublic(
        id=listing.id,
        kind=listing.kind,
        title=listing.title,
        description=listing.description,
        sought_sector=listing.sought_sector,
        author_name=_author_label(author),
        author_organization=author.organization if author else None,
        author_sector=author.sector if author else None,
        created_at=listing.created_at,
        is_mine=user is not None and listing.author_id == user.id,
    )


@router.get("/mentors", response_model=list[MentorPublic])
async def list_mentors(session: SessionDep) -> list[MentorPublic]:
    rows = session.exec(
        select(User).where(User.role == RoleEnum.SPECIALIST).order_by(col(User.name))
    ).all()
    return [
        MentorPublic(
            id=row.id,
            name=_author_label(row),
            organization=row.organization,
            sector=row.sector,
            bio=row.mentor_bio,
        )
        for row in rows
    ]


@router.get("/partnerships", response_model=list[ListingPublic])
async def list_listings(user: OptionalUserDep, session: SessionDep) -> list[ListingPublic]:
    rows = session.exec(
        select(PartnershipListing)
        .order_by(col(PartnershipListing.created_at).desc())
        .limit(LISTINGS_LIMIT)
    ).all()
    return [_listing_public(session, row, user) for row in rows]


@router.post("/partnerships", response_model=ListingPublic, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingInput, user: CurrentUserDep, session: SessionDep
) -> ListingPublic:
    if user.sector is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uzupełnij sektor w profilu, zanim dodasz ogłoszenie",
        )
    listing = PartnershipListing(
        author_id=user.id,
        kind=payload.kind,
        title=payload.title,
        description=payload.description,
        sought_sector=payload.sought_sector,
    )
    session.add(listing)
    session.commit()
    session.refresh(listing)
    logger.info("Nowe ogłoszenie partnerskie %s (autor %s)", listing.id, user.id)
    return _listing_public(session, listing, user)


@router.delete("/partnerships/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(listing_id: uuid.UUID, user: CurrentUserDep, session: SessionDep) -> None:
    """Autor usuwa swoje ogłoszenie; admin — dowolne (moderacja)."""
    listing = session.get(PartnershipListing, listing_id)
    allowed = listing is not None and (
        listing.author_id == user.id or user.role == RoleEnum.ADMIN
    )
    if listing is None or not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak ogłoszenia")
    # rozmowy zostają (temat to kopia tytułu) — odpinamy je tylko od ogłoszenia
    for conversation in session.exec(
        select(Conversation).where(Conversation.listing_id == listing.id)
    ).all():
        conversation.listing_id = None
        session.add(conversation)
    session.delete(listing)
    session.commit()
    logger.info("Usunięto ogłoszenie partnerskie %s (przez %s)", listing_id, user.id)


@router.post(
    "/partnerships/{listing_id}/contact",
    response_model=ConversationDetail,
    status_code=status.HTTP_201_CREATED,
)
async def contact_listing_author(
    listing_id: uuid.UUID, payload: MessageInput, user: CurrentUserDep, session: SessionDep
) -> ConversationDetail:
    """Odpowiedź na ogłoszenie: otwiera rozmowę z autorem albo dopisuje do już istniejącej."""
    listing = session.get(PartnershipListing, listing_id)
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak ogłoszenia")
    if listing.author_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="To Twoje ogłoszenie",
        )
    _throttle(session, user)
    conversation = session.exec(
        select(Conversation).where(
            Conversation.listing_id == listing.id, Conversation.author_id == user.id
        )
    ).first()
    if conversation is None:
        conversation = Conversation(
            kind=ConversationKind.PARTNERSHIP,
            subject=listing.title,
            author_id=user.id,
            recipient_id=listing.author_id,
            listing_id=listing.id,
        )
    conversation.status = ConversationStatus.OPEN
    _add_message(session, conversation, user, "author", payload.body)
    session.commit()
    session.refresh(conversation)
    logger.info("Odpowiedź na ogłoszenie %s → rozmowa %s", listing.id, conversation.id)
    return _conversation_detail(session, conversation, user, "author")


@router.get("/conversations", response_model=list[ConversationPublic])
async def list_conversations(user: CurrentUserDep, session: SessionDep) -> list[ConversationPublic]:
    """Rozmowy, w których uczestniczę; admin widzi też wszystkie pytania do ROPS."""
    mine = [Conversation.author_id == user.id, Conversation.recipient_id == user.id]
    if user.role == RoleEnum.ADMIN:
        mine.append(Conversation.kind == ConversationKind.QUESTION)
    rows = session.exec(
        select(Conversation).where(or_(*mine)).order_by(col(Conversation.last_message_at).desc())
    ).all()
    result: list[ConversationPublic] = []
    for row in rows:
        side = _side(row, user)
        if side is not None:
            result.append(ConversationPublic(**_conversation_fields(session, row, user, side)))
    return result


@router.post(
    "/conversations", response_model=ConversationDetail, status_code=status.HTTP_201_CREATED
)
async def create_conversation(
    payload: ConversationInput, user: CurrentUserDep, session: SessionDep
) -> ConversationDetail:
    kind = ConversationKind(payload.kind)
    recipient_id: uuid.UUID | None = None
    if kind == ConversationKind.MENTORING:
        mentor = session.get(User, payload.mentor_id) if payload.mentor_id else None
        if mentor is None or mentor.role != RoleEnum.SPECIALIST:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak mentora")
        if mentor.id == user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nie można napisać do siebie",
            )
        recipient_id = mentor.id
    _throttle(session, user)
    conversation = Conversation(
        kind=kind, subject=payload.subject, author_id=user.id, recipient_id=recipient_id
    )
    _add_message(session, conversation, user, "author", payload.body)
    session.commit()
    session.refresh(conversation)
    logger.info("Nowa rozmowa %s (%s, autor %s)", conversation.id, kind.value, user.id)
    return _conversation_detail(session, conversation, user, "author")


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> ConversationDetail:
    """Rozmowa z wiadomościami. Odpytywana cyklicznie przez klienta, oznacza jako przeczytaną."""
    conversation, side = _own_conversation(session, conversation_id, user)
    # zapis tylko gdy jest co oznaczyć — inaczej każde odpytanie pisałoby do bazy
    if _is_unread(conversation, side):
        _mark_read(conversation, side, _now())
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
    return _conversation_detail(session, conversation, user, side)


@router.patch("/conversations/{conversation_id}", response_model=ConversationDetail)
async def set_conversation_status(
    conversation_id: uuid.UUID,
    payload: ConversationStatusUpdate,
    user: CurrentUserDep,
    session: SessionDep,
) -> ConversationDetail:
    conversation, side = _own_conversation(session, conversation_id, user)
    conversation.status = payload.status
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    logger.info(
        "Rozmowa %s → %s (przez %s)", conversation.id, conversation.status.value, user.id
    )
    return _conversation_detail(session, conversation, user, side)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationDetail,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: uuid.UUID, payload: MessageInput, user: CurrentUserDep, session: SessionDep
) -> ConversationDetail:
    conversation, side = _own_conversation(session, conversation_id, user)
    if conversation.status == ConversationStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rozmowa jest zamknięta",
        )
    _throttle(session, user)
    _add_message(session, conversation, user, side, payload.body)
    session.commit()
    session.refresh(conversation)
    logger.info("Wiadomość w rozmowie %s (autor %s)", conversation.id, user.id)
    return _conversation_detail(session, conversation, user, side)
