import uuid
from datetime import datetime

import pytest
from sqlmodel import select

from app import models as m
from app.routes.communication import THROTTLE_MESSAGES

from .conftest import ANY_ID, assert_login_required, call

USER_ROUTES = [
    ("POST", "/partnerships"),
    ("DELETE", f"/partnerships/{ANY_ID}"),
    ("POST", f"/partnerships/{ANY_ID}/contact"),
    ("GET", "/conversations"),
    ("POST", "/conversations"),
    ("GET", f"/conversations/{ANY_ID}"),
    ("PATCH", f"/conversations/{ANY_ID}"),
    ("POST", f"/conversations/{ANY_ID}/messages"),
]

LISTING = {"kind": "szukam", "title": "Szukamy sali", "description": "Na warsztaty dla seniorów."}
QUESTION = {"kind": "pytanie", "subject": "Pytanie o nabór", "body": "Czy NGO może złożyć wniosek?"}


@pytest.mark.parametrize(("method", "path"), USER_ROUTES)
def test_access(as_role, method, path):
    role, client = as_role
    assert_login_required(role, call(client, method, path).status_code)


@pytest.mark.parametrize("path", ["/mentors", "/partnerships"])
def test_public_lists_are_open_to_guests(client, path):
    response = client.get(path)

    assert response.status_code == 200
    assert response.json() == []


# --- mentorzy ---------------------------------------------------------------


def test_mentors_are_specialists_shown_without_contact_data(client, make_user, user, admin):
    make_user(
        "specialist",
        name="Maria",
        surname="Mentorska",
        email="maria@example.com",
        phone_number="500000000",
        sector="ngo",
        organization="Fundacja",
        mentor_bio="Ekonomia społeczna",
    )

    body = client.get("/mentors").json()

    assert body == [
        {
            "id": body[0]["id"],
            "name": "Maria M.",
            "organization": "Fundacja",
            "sector": "ngo",
            "bio": "Ekonomia społeczna",
        }
    ]


# --- ogłoszenia partnerskie -------------------------------------------------


@pytest.fixture
def with_sector(db, user):
    user.sector = m.SectorEnum.NGO
    user.organization = "Fundacja Dobra"
    db.add(user)
    db.commit()
    return user


def test_listing_requires_sector_in_profile(user_client):
    response = user_client.post("/partnerships", json=LISTING)

    assert response.status_code == 400
    assert "sektor" in response.json()["detail"]


@pytest.mark.parametrize("kind", [kind.value for kind in m.ListingKind])
@pytest.mark.parametrize("sought", [None, *(sector.value for sector in m.SectorEnum)])
def test_listing_is_published_with_author_card(user_client, with_sector, kind, sought):
    response = user_client.post(
        "/partnerships", json={**LISTING, "kind": kind, "sought_sector": sought}
    )

    assert response.status_code == 201
    body = response.json()
    assert (body["kind"], body["sought_sector"]) == (kind, sought)
    assert body["author_name"] == "Ula Z."
    assert body["author_organization"] == "Fundacja Dobra"
    assert body["author_sector"] == "ngo"
    assert body["is_mine"] is True


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"kind": "sprzedam"}, id="nieznany-rodzaj"),
        pytest.param({"title": "S"}, id="tytul-za-krotki"),
        pytest.param({"title": "   "}, id="tytul-same-spacje"),
        pytest.param({"title": "x" * (m.THREAD_SUBJECT_MAX + 1)}, id="tytul-za-dlugi"),
        pytest.param({"description": "x"}, id="opis-za-krotki"),
        pytest.param({"description": "x" * (m.MESSAGE_BODY_MAX + 1)}, id="opis-za-dlugi"),
        pytest.param({"sought_sector": "wojsko"}, id="nieznany-sektor"),
        pytest.param({"author_id": ANY_ID}, id="nadmiarowe-pole"),
    ],
)
def test_listing_rejects_invalid_payload(user_client, with_sector, change):
    assert user_client.post("/partnerships", json={**LISTING, **change}).status_code == 422


@pytest.mark.parametrize(
    ("viewer", "is_mine"), [("author", True), ("other", False), ("guest", False)]
)
def test_listing_is_marked_as_mine_only_for_its_author(
    client, user_client, other_client, user, make_listing, viewer, is_mine
):
    make_listing(user)
    viewer_client = {"author": user_client, "other": other_client, "guest": client}[viewer]

    [row] = viewer_client.get("/partnerships").json()

    assert row["is_mine"] is is_mine


@pytest.mark.parametrize(
    ("who", "status"),
    [("author", 204), pytest.param("admin", 204, id="admin-moderacja"), ("other", 404)],
)
def test_listing_delete_permissions(
    user_client, other_client, admin_client, db, user, make_listing, who, status
):
    listing = make_listing(user)
    actor = {"author": user_client, "admin": admin_client, "other": other_client}[who]

    assert actor.delete(f"/partnerships/{listing.id}").status_code == status
    assert len(db.exec(select(m.PartnershipListing)).all()) == (0 if status == 204 else 1)


def test_deleting_listing_keeps_its_conversations(user_client, other_client, db, user, make_listing):
    listing = make_listing(user)
    thread_id = other_client.post(
        f"/partnerships/{listing.id}/contact", json={"body": "Mamy salę"}
    ).json()["id"]

    assert user_client.delete(f"/partnerships/{listing.id}").status_code == 204

    assert user_client.get(f"/conversations/{thread_id}").status_code == 200
    assert db.get(m.Conversation, uuid.UUID(thread_id)).listing_id is None


def test_contact_opens_one_thread_per_person_and_listing(
    user_client, other_client, db, user, other_user, make_listing
):
    listing = make_listing(user, title="Szukamy sali")
    path = f"/partnerships/{listing.id}/contact"

    first = other_client.post(path, json={"body": "Mamy salę"})
    other_client.patch(f"/conversations/{first.json()['id']}", json={"status": "zamknieta"})
    second = other_client.post(path, json={"body": "Jeszcze jedno"})

    assert first.status_code == 201
    assert first.json()["kind"] == "partnerstwo"
    assert first.json()["subject"] == "Szukamy sali"
    assert first.json()["counterpart_name"] == "Ula Zwykła"
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["status"] == "otwarta", "nowa wiadomość otwiera rozmowę ponownie"
    assert [message["body"] for message in second.json()["messages"]] == ["Mamy salę", "Jeszcze jedno"]
    [inbox] = user_client.get("/conversations").json()
    assert inbox["unread"] is True
    assert inbox["counterpart_name"] == "Olek Inny"
    assert inbox["counterpart_email"] is None


@pytest.mark.parametrize(
    ("who", "target", "status"),
    [
        pytest.param("author", "own", 400, id="wlasne-ogloszenie"),
        pytest.param("other", "missing", 404, id="nieznane-ogloszenie"),
    ],
)
def test_contact_rejections(user_client, other_client, user, make_listing, who, target, status):
    listing_id = make_listing(user).id if target == "own" else uuid.uuid4()
    actor = user_client if who == "author" else other_client

    response = actor.post(f"/partnerships/{listing_id}/contact", json={"body": "Dzień dobry"})

    assert response.status_code == status


# --- rozmowy ----------------------------------------------------------------


def test_question_goes_to_the_whole_rops_team(user_client, admin_client, make_user, client_for, user):
    created = user_client.post("/conversations", json=QUESTION)
    second_admin = client_for(make_user("admin"))

    assert created.status_code == 201
    body = created.json()
    assert body["counterpart_name"] == "Zespół ROPS"
    assert body["unread"] is False
    assert [(msg["body"], msg["is_mine"]) for msg in body["messages"]] == [(QUESTION["body"], True)]
    for team_member in (admin_client, second_admin):
        [row] = team_member.get("/conversations").json()
        assert row["id"] == body["id"]
        assert row["unread"] is True
        assert row["counterpart_name"] == "Ula Zwykła"
        assert row["counterpart_email"] == user.email


def test_mentoring_thread_goes_to_the_chosen_mentor(user_client, specialist_client, specialist):
    created = user_client.post(
        "/conversations",
        json={**QUESTION, "kind": "mentoring", "mentor_id": str(specialist.id)},
    )

    assert created.status_code == 201
    assert created.json()["counterpart_name"] == "Maria Mentorska"
    [row] = specialist_client.get("/conversations").json()
    assert row["kind"] == "mentoring"
    assert row["counterpart_name"] == "Ula Zwykła"
    assert row["counterpart_email"] is None, "e-mail autora widzi tylko zespół w pytaniach do ROPS"


@pytest.mark.parametrize(
    ("mentor", "status"),
    [
        pytest.param("none", 404, id="bez-mentora"),
        pytest.param("unknown", 404, id="nieznany"),
        pytest.param("regular-user", 404, id="zwykly-user"),
        pytest.param("admin", 404, id="admin-nie-jest-mentorem"),
    ],
)
def test_mentoring_needs_a_real_mentor(user_client, other_user, admin, mentor, status):
    mentor_id = {
        "none": None,
        "unknown": str(uuid.uuid4()),
        "regular-user": str(other_user.id),
        "admin": str(admin.id),
    }[mentor]

    response = user_client.post(
        "/conversations", json={**QUESTION, "kind": "mentoring", "mentor_id": mentor_id}
    )

    assert response.status_code == status


def test_mentor_cannot_write_to_themselves(specialist_client, specialist):
    response = specialist_client.post(
        "/conversations", json={**QUESTION, "kind": "mentoring", "mentor_id": str(specialist.id)}
    )

    assert response.status_code == 400


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"kind": "partnerstwo"}, id="rodzaj-zarezerwowany-dla-ogloszen"),
        pytest.param({"kind": "skarga"}, id="nieznany-rodzaj"),
        pytest.param({"subject": "P"}, id="temat-za-krotki"),
        pytest.param({"subject": "x" * (m.THREAD_SUBJECT_MAX + 1)}, id="temat-za-dlugi"),
        pytest.param({"body": ""}, id="pusta-tresc"),
        pytest.param({"body": "   "}, id="tresc-same-spacje"),
        pytest.param({"body": "x" * (m.MESSAGE_BODY_MAX + 1)}, id="tresc-za-dluga"),
        pytest.param({"recipient_id": ANY_ID}, id="nadmiarowe-pole"),
    ],
)
def test_conversation_rejects_invalid_payload(user_client, db, change):
    response = user_client.post("/conversations", json={**QUESTION, **change})

    assert response.status_code == 422
    assert db.exec(select(m.Conversation)).all() == []


#: Kto widzi rozmowę danego rodzaju: (rodzaj, kto pyta) → czy ma dostęp.
VISIBILITY = [
    ("pytanie", "author", True),
    ("pytanie", "admin", True),
    ("pytanie", "specialist", False),
    ("pytanie", "other", False),
    ("mentoring", "author", True),
    ("mentoring", "specialist", True),
    pytest.param("mentoring", "admin", False, id="mentoring-admin-nie-czyta-prywatnych"),
    ("mentoring", "other", False),
]


@pytest.fixture
def actors(user_client, other_client, admin_client, specialist_client):
    return {
        "author": user_client,
        "other": other_client,
        "admin": admin_client,
        "specialist": specialist_client,
    }


@pytest.mark.parametrize(("kind", "who", "allowed"), VISIBILITY)
@pytest.mark.parametrize(
    ("method", "suffix", "payload", "ok"),
    [
        pytest.param("GET", "", None, 200, id="odczyt"),
        pytest.param("POST", "/messages", {"body": "Dopisek"}, 201, id="odpowiedz"),
        pytest.param("PATCH", "", {"status": "zamknieta"}, 200, id="zamkniecie"),
    ],
)
def test_conversation_is_visible_only_to_its_sides(
    actors, db, user, specialist, make_conversation, kind, who, allowed, method, suffix, payload, ok
):
    recipient = specialist if kind == "mentoring" else None
    thread = make_conversation(user, kind, recipient=recipient)

    response = actors[who].request(method, f"/conversations/{thread.id}{suffix}", json=payload)
    listed = [row["id"] for row in actors[who].get("/conversations").json()]

    assert response.status_code == (ok if allowed else 404)
    assert (str(thread.id) in listed) is allowed
    if not allowed:
        db.refresh(thread)
        assert thread.status == m.ConversationStatus.OPEN
        assert len(db.exec(select(m.Message)).all()) == 1


def test_unread_flag_follows_the_last_message(user_client, admin_client):
    thread_id = user_client.post("/conversations", json=QUESTION).json()["id"]
    unread = lambda client: client.get("/conversations").json()[0]["unread"]  # noqa: E731

    assert (unread(user_client), unread(admin_client)) == (False, True)

    admin_client.get(f"/conversations/{thread_id}")  # odczyt oznacza jako przeczytane
    assert unread(admin_client) is False

    reply = admin_client.post(f"/conversations/{thread_id}/messages", json={"body": "Tak, może."})
    assert reply.status_code == 201
    assert (unread(user_client), unread(admin_client)) == (True, False)

    detail = user_client.get(f"/conversations/{thread_id}").json()
    assert unread(user_client) is False
    # autor pytania widzi odpowiedź podpisaną zespołem, nie nazwiskiem admina
    assert [(msg["author_name"], msg["is_mine"]) for msg in detail["messages"]] == [
        ("Ula Zwykła", True),
        ("Zespół ROPS", False),
    ]


def test_message_body_is_trimmed_and_validated(user_client, user, make_conversation):
    thread = make_conversation(user)
    path = f"/conversations/{thread.id}/messages"

    assert user_client.post(path, json={"body": "  Dopisek  "}).json()["messages"][-1]["body"] == "Dopisek"
    for body in ("", "   ", "x" * (m.MESSAGE_BODY_MAX + 1)):
        assert user_client.post(path, json={"body": body}).status_code == 422


@pytest.mark.parametrize("closed_by", ["author", "admin"])
def test_closed_conversation_refuses_messages_until_reopened(
    actors, user, make_conversation, closed_by
):
    thread = make_conversation(user)
    path = f"/conversations/{thread.id}"

    assert actors[closed_by].patch(path, json={"status": "zamknieta"}).json()["status"] == "zamknieta"
    assert actors["author"].post(f"{path}/messages", json={"body": "Halo?"}).status_code == 409

    assert actors["author"].patch(path, json={"status": "otwarta"}).status_code == 200
    assert actors["author"].post(f"{path}/messages", json={"body": "Halo?"}).status_code == 201


@pytest.mark.parametrize("payload", [{"status": "archiwum"}, {}, {"status": "otwarta", "x": 1}])
def test_conversation_status_validation(user_client, user, make_conversation, payload):
    thread = make_conversation(user)

    assert user_client.patch(f"/conversations/{thread.id}", json=payload).status_code == 422


@pytest.mark.parametrize(
    "send",
    [
        pytest.param(lambda c, thread, listing: c.post("/conversations", json=QUESTION), id="nowa-rozmowa"),
        pytest.param(
            lambda c, thread, listing: c.post(f"/conversations/{thread.id}/messages", json={"body": "x"}),
            id="odpowiedz",
        ),
        pytest.param(
            lambda c, thread, listing: c.post(f"/partnerships/{listing.id}/contact", json={"body": "x"}),
            id="kontakt-z-ogloszenia",
        ),
    ],
)
def test_message_flood_is_throttled(user_client, db, user, other_user, make_conversation, make_listing, send):
    thread, listing = make_conversation(user), make_listing(other_user)
    now = datetime.now().isoformat()
    db.add_all(
        m.Message(conversation_id=thread.id, author_id=user.id, body="spam", created_at=now)
        for _ in range(THROTTLE_MESSAGES)
    )
    db.commit()

    assert send(user_client, thread, listing).status_code == 429


def test_throttle_counts_each_author_separately(user_client, admin_client, db, user, make_conversation):
    thread = make_conversation(user)
    now = datetime.now().isoformat()
    db.add_all(
        m.Message(conversation_id=thread.id, author_id=user.id, body="spam", created_at=now)
        for _ in range(THROTTLE_MESSAGES)
    )
    db.commit()

    response = admin_client.post(f"/conversations/{thread.id}/messages", json={"body": "Odpowiedź"})

    assert response.status_code == 201
