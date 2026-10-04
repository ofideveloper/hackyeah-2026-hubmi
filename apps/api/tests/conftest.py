"""Wspólna konfiguracja testów API.

Kolejność ma znaczenie: zmienne środowiskowe muszą być ustawione, zanim cokolwiek
zaimportuje `app` — silnik bazy powstaje przy imporcie `app.dependencies.db`.
"""

import os
import tempfile
import uuid
from collections import deque
from datetime import date, timedelta
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="hubmi-tests-"))
os.environ.update(
    {
        # Osobny plik SQLite — dev-owa `data/hubmi.db` zostaje nietknięta.
        "DATABASE_URL": f"sqlite:///{_TMP_DIR / 'test.db'}",
        "SECRET_KEY": "test-secret-not-for-production-0123456789",
        "ADMIN_EMAIL": "admin@example.com",
        "ADMIN_PASSWORD": "admin-test-password",
        "SCRAPE_ON_STARTUP": "false",
        "LOG_LEVEL": "WARNING",
        "LLM_PROVIDER": "fake",
        "LLM_API_KEY": "test-key",
        # Martwy adres: gdyby test nie podmienił modelu, żądanie odpada od razu.
        "LLM_BASE_URL": "http://127.0.0.1:9",
        "LLM_RETRIES": "0",
    }
)
os.environ.pop("VERCEL", None)

import pytest  # noqa: E402
from app import models as m  # noqa: E402
from app.dependencies.auth import create_access_token, hash_password  # noqa: E402
from app.dependencies.db import create_db_and_tables, engine  # noqa: E402
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, SQLModel  # noqa: E402

PASSWORD = "haslo-testowe-123"
# scrypt jest celowo wolny — jeden hash na całą sesję testów.
_PASSWORD_HASH = hash_password(PASSWORD)

ROLES = ("anonymous", "user", "specialist", "admin")


# --- baza -------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def _schema():
    create_db_and_tables()


@pytest.fixture(autouse=True)
def _clean_database():
    """Każdy test zaczyna z pustą bazą (a więc i z wyzerowanymi limitami żądań)."""
    yield
    with engine.begin() as connection:
        for table in reversed(SQLModel.metadata.sorted_tables):
            connection.execute(table.delete())


@pytest.fixture
def db():
    """Sesja do przygotowania danych i sprawdzania skutków w bazie.

    API zapisuje własnymi sesjami — przed asercją na wcześniej pobranym obiekcie
    wywołaj `db.refresh(obj)`.
    """
    with Session(engine, expire_on_commit=False) as session:
        yield session


def _save(db: Session, row):
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# --- klient i role ----------------------------------------------------------


def _client(user: m.User | None = None) -> TestClient:
    # Bez `with`: zdarzenie startup (seed, scraper) się nie odpala — dane tworzą fixture'y.
    headers = {"Authorization": f"Bearer {create_access_token(user)}"} if user else None
    return TestClient(app, headers=headers)


@pytest.fixture
def client() -> TestClient:
    """Klient bez sesji (gość)."""
    return _client()


@pytest.fixture
def client_for():
    """`client_for(user)` → klient z tokenem tego użytkownika."""
    return _client


@pytest.fixture
def make_user(db):
    def factory(role: m.RoleEnum | str = m.RoleEnum.USER, **fields) -> m.User:
        fields.setdefault("email", f"{uuid.uuid4().hex[:12]}@example.com")
        fields.setdefault("name", "Tosia")
        fields.setdefault("surname", "Testowa")
        return _save(
            db, m.User(role=m.RoleEnum(role), hashed_password=_PASSWORD_HASH, **fields)
        )

    return factory


@pytest.fixture
def user(make_user) -> m.User:
    return make_user(email="user@example.com", name="Ula", surname="Zwykła")


@pytest.fixture
def other_user(make_user) -> m.User:
    return make_user(email="other@example.com", name="Olek", surname="Inny")


@pytest.fixture
def specialist(make_user) -> m.User:
    return make_user(
        m.RoleEnum.SPECIALIST,
        email="mentor@example.com",
        name="Maria",
        surname="Mentorska",
    )


@pytest.fixture
def admin(make_user) -> m.User:
    return make_user(
        m.RoleEnum.ADMIN, email="admin@example.com", name="Ada", surname="Admin"
    )


@pytest.fixture
def user_client(user) -> TestClient:
    return _client(user)


@pytest.fixture
def other_client(other_user) -> TestClient:
    return _client(other_user)


@pytest.fixture
def specialist_client(specialist) -> TestClient:
    return _client(specialist)


@pytest.fixture
def admin_client(admin) -> TestClient:
    return _client(admin)


@pytest.fixture(params=ROLES)
def as_role(request, make_user) -> tuple[str, TestClient]:
    """Mnoży test przez role: zwraca `(nazwa_roli, klient)`."""
    role = request.param
    if role == "anonymous":
        return role, _client()
    return role, _client(make_user(role))


def call(client: TestClient, method: str, path: str):
    """Żądanie do macierzy dostępu — puste body, bo liczy się tylko decyzja o dostępie."""
    return client.request(
        method, path, json=None if method in ("GET", "DELETE") else {}
    )


def assert_admin_only(role: str, status_code: int) -> None:
    expected = {"anonymous": 401, "user": 403, "specialist": 403}
    if role in expected:
        assert status_code == expected[role]
    else:
        # Admin przechodzi autoryzację; 404/422 wynika już z pustego żądania.
        assert status_code not in (401, 403)


def assert_login_required(role: str, status_code: int) -> None:
    if role == "anonymous":
        assert status_code == 401
    else:
        assert status_code not in (401, 403)


#: Losowy, poprawny identyfikator do ścieżek w macierzach dostępu.
ANY_ID = "00000000-0000-4000-8000-000000000000"


# --- dane domenowe ----------------------------------------------------------


@pytest.fixture
def make_category(db):
    def factory(name: str | None = None) -> m.CategoriesOfProjects:
        return _save(
            db, m.CategoriesOfProjects(name=name or f"Obszar {uuid.uuid4().hex[:6]}")
        )

    return factory


@pytest.fixture
def category(make_category) -> m.CategoriesOfProjects:
    return make_category("Dla seniorów")


@pytest.fixture
def make_project(db, make_category):
    def factory(
        category: m.CategoriesOfProjects | None = None, **fields
    ) -> m.ActualProject:
        fields.setdefault("name", f"Innowacja {uuid.uuid4().hex[:6]}")
        fields.setdefault("description", "1. Na czym polega\nOpis rozwiązania.")
        return _save(
            db, m.ActualProject(category_id=(category or make_category()).id, **fields)
        )

    return factory


@pytest.fixture
def catalog(make_category, make_project) -> list[m.ActualProject]:
    """Mały katalog: dwa obszary, trzy innowacje."""
    seniors, youth = make_category("Dla seniorów"), make_category("Dla młodzieży")
    return [
        make_project(
            seniors, name="Teleopieka domowa", description="Opaska z przyciskiem SOS."
        ),
        make_project(
            seniors, name="Klub sąsiedzki", description="Spotkania samotnych seniorów."
        ),
        make_project(
            youth,
            name="Mobilny streetworker",
            description="Praca z młodzieżą w terenie.",
        ),
    ]


@pytest.fixture
def make_idea(db, make_category):
    def factory(
        author: m.User, status: m.StatusEnum | str = m.StatusEnum.PENDING, **fields
    ) -> m.ProposalOfNewProject:
        if "category" in fields:
            fields["category_id"] = fields.pop("category").id
        elif "category_id" not in fields:
            fields["category_id"] = make_category().id
        fields.setdefault("name", f"Fiszka {uuid.uuid4().hex[:6]}")
        fields.setdefault("description", "Opis pomysłu.")
        return _save(
            db,
            m.ProposalOfNewProject(
                author_id=author.id, status=m.StatusEnum(status), **fields
            ),
        )

    return factory


@pytest.fixture
def make_grant_call(db):
    def factory(
        opens_in: int = -1, closes_in: int = 7, questions=None, **fields
    ) -> m.GrantCall:
        import json

        questions = questions or [
            {"key": "q1", "label": "Cel projektu", "hint": ""},
            {"key": "q2", "label": "Budżet", "hint": ""},
        ]
        fields.setdefault("title", f"Nabór {uuid.uuid4().hex[:6]}")
        today = date.today()
        return _save(
            db,
            m.GrantCall(
                opens_on=today + timedelta(days=opens_in),
                closes_on=today + timedelta(days=closes_in),
                questions=json.dumps(questions),
                **fields,
            ),
        )

    return factory


def _target(target) -> tuple[m.TestTargetKind, uuid.UUID]:
    kind = (
        m.TestTargetKind.IDEA
        if isinstance(target, m.ProposalOfNewProject)
        else m.TestTargetKind.INNOVATION
    )
    return kind, target.id


@pytest.fixture
def make_signup(db):
    def factory(
        tester: m.User,
        target,
        status: m.StatusEnum | str = m.StatusEnum.PENDING,
        **fields,
    ) -> m.TesterSignup:
        kind, target_id = _target(target)
        return _save(
            db,
            m.TesterSignup(
                user_id=tester.id,
                target_kind=kind,
                target_id=target_id,
                status=m.StatusEnum(status),
                **fields,
            ),
        )

    return factory


@pytest.fixture
def make_review(db):
    def factory(author: m.User, target, rating: int = 4, **fields) -> m.SolutionReview:
        kind, target_id = _target(target)
        return _save(
            db,
            m.SolutionReview(
                author_id=author.id,
                target_kind=kind,
                target_id=target_id,
                rating=rating,
                **fields,
            ),
        )

    return factory


@pytest.fixture
def make_listing(db):
    def factory(author: m.User, **fields) -> m.PartnershipListing:
        fields.setdefault("kind", m.ListingKind.SEEKING)
        fields.setdefault("title", f"Ogłoszenie {uuid.uuid4().hex[:6]}")
        fields.setdefault("description", "Szukamy partnera do pilotażu.")
        return _save(db, m.PartnershipListing(author_id=author.id, **fields))

    return factory


@pytest.fixture
def make_conversation(db):
    def factory(
        author: m.User,
        kind: m.ConversationKind | str = m.ConversationKind.QUESTION,
        recipient: m.User | None = None,
        body: str = "Pierwsza wiadomość",
        **fields,
    ) -> m.Conversation:
        fields.setdefault("subject", f"Temat {uuid.uuid4().hex[:6]}")
        conversation = _save(
            db,
            m.Conversation(
                kind=m.ConversationKind(kind),
                author_id=author.id,
                recipient_id=recipient.id if recipient else None,
                last_author_id=author.id,
                **fields,
            ),
        )
        _save(
            db,
            m.Message(
                conversation_id=conversation.id,
                author_id=author.id,
                body=body,
                created_at=conversation.last_message_at,
            ),
        )
        return conversation

    return factory


# --- zależności zewnętrzne: model i scraper ---------------------------------


class FakeLLM:
    """Atrapa `ask_llm`: zwraca zaskryptowane odpowiedzi i zapamiętuje prompty."""

    def __init__(self) -> None:
        self.replies: deque[str | Exception] = deque()
        self.default = "Odpowiedź modelu."
        self.calls: list[list[dict[str, str]]] = []

    def reply(self, *replies: str | Exception) -> "FakeLLM":
        self.replies.extend(replies)
        return self

    async def __call__(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        answer = self.replies.popleft() if self.replies else self.default
        if isinstance(answer, Exception):
            raise answer
        return answer


@pytest.fixture
def llm(monkeypatch) -> FakeLLM:
    """Podmienia model we wszystkich modułach, które importują `ask_llm` po nazwie."""
    fake = FakeLLM()
    for module in ("app.routes.chat", "app.routes.ideas", "app.routes.middleman"):
        monkeypatch.setattr(f"{module}.ask_llm", fake)
    return fake


class FakeScraper:
    def __init__(self) -> None:
        self.added = 0
        self.calls = 0

    def __call__(self) -> int:
        self.calls += 1
        return self.added


@pytest.fixture(autouse=True)
def scraper(monkeypatch) -> FakeScraper:
    """Żaden test nie pobiera danych z rops.krakow.pl — scraper jest atrapą."""
    fake = FakeScraper()
    # Scraper w czacie wyłączony — po przywróceniu: dopisz "app.routes.chat" i odkomentuj reset karencji.
    for module in ("app.routes.knowledge", "app.seed"):
        monkeypatch.setattr(f"{module}.refresh_new_projects", fake)
    # monkeypatch.setattr("app.routes.chat._last_refresh", None)
    return fake


@pytest.fixture
def settings(monkeypatch):
    """Ustawienia aplikacji z możliwością nadpisania na czas testu (`settings(chat_rate_guest=2)`)."""
    from app.config import get_settings

    current = get_settings()

    def override(**values):
        for key, value in values.items():
            monkeypatch.setattr(current, key, value)
        return current

    return override
