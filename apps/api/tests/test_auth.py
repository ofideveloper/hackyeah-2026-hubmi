from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.config import get_settings
from app.dependencies.auth import create_access_token

from .conftest import PASSWORD

VALID = {
    "email": "nowy@example.com",
    "password": "bardzo-tajne-haslo",
    "name": "Jan",
    "surname": "Kowalski",
}


def test_register_creates_regular_user(client):
    response = client.post("/auth/register", json=VALID)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == VALID["email"]
    assert body["role"] == "user"
    assert body["full_name"] == "Jan Kowalski"
    assert "password" not in body and "hashed_password" not in body


@pytest.mark.parametrize(
    "extra",
    [
        pytest.param({"role": "admin"}, id="role-admin"),
        pytest.param({"role": "specialist"}, id="role-specialist"),
        pytest.param({"sector": "ngo", "mentor_bio": "Ekspert"}, id="pola-profilu"),
        pytest.param({"id": "00000000-0000-4000-8000-000000000001"}, id="wlasne-id"),
    ],
)
def test_register_ignores_privileged_fields(client, extra):
    body = client.post("/auth/register", json={**VALID, **extra}).json()

    assert body["role"] == "user"
    assert body["sector"] is None and body["mentor_bio"] is None
    assert body["id"] != "00000000-0000-4000-8000-000000000001"


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"password": "krotkie"}, id="haslo-7-znakow"),
        pytest.param({"password": None}, id="brak-hasla"),
        pytest.param({"email": "to-nie-email"}, id="zly-email"),
        pytest.param({"email": "jan@localhost"}, id="email-bez-domeny"),
        pytest.param({"name": None}, id="brak-imienia"),
        pytest.param({"surname": None}, id="brak-nazwiska"),
        pytest.param({"phone_number": "123"}, id="telefon-za-krotki"),
        pytest.param({"phone_number": "abc def ghi"}, id="telefon-litery"),
        pytest.param({"phone_number": "+48 500 000 000 000 000"}, id="telefon-za-dlugi"),
        pytest.param({"phone_number": "500--000--000"}, id="telefon-podwojny-separator"),
    ],
)
def test_register_rejects_invalid_payload(client, change):
    payload = {key: value for key, value in {**VALID, **change}.items() if value is not None}

    assert client.post("/auth/register", json=payload).status_code == 422


@pytest.mark.parametrize(
    ("phone", "stored"),
    [
        ("+48 500 000 000", "+48 500 000 000"),
        ("500000000", "500000000"),
        ("500-000-000", "500-000-000"),
        ("  500 000 000  ", "500 000 000"),
        ("", None),
        ("   ", None),
        (None, None),
    ],
)
def test_register_normalizes_phone_number(client, phone, stored):
    response = client.post("/auth/register", json={**VALID, "phone_number": phone})

    assert response.status_code == 201
    assert response.json()["phone_number"] == stored


@pytest.mark.parametrize(
    "email",
    ["user@example.com", "USER@example.com", "User@Example.COM"],
)
def test_register_rejects_taken_email_regardless_of_case(client, user, email):
    response = client.post("/auth/register", json={**VALID, "email": email})

    assert response.status_code == 409
    assert response.json()["detail"] == "Konto z tym adresem email już istnieje"


@pytest.mark.parametrize(
    "username",
    ["user@example.com", "USER@EXAMPLE.COM", "  user@example.com  "],
)
def test_login_returns_working_token(client, user, username):
    response = client.post("/auth/login", data={"username": username, "password": PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["id"] == str(user.id)


@pytest.mark.parametrize(
    ("username", "password"),
    [
        pytest.param("user@example.com", "zle-haslo-12345", id="zle-haslo"),
        pytest.param("user@example.com", PASSWORD.upper(), id="haslo-inna-wielkosc-liter"),
        pytest.param("nikt@example.com", PASSWORD, id="nieznany-email"),
    ],
)
def test_login_rejects_bad_credentials_with_one_message(client, user, username, password):
    response = client.post("/auth/login", data={"username": username, "password": password})

    # Ten sam komunikat dla złego hasła i nieznanego konta — bez zdradzania, które istnieją
    assert response.status_code == 400
    assert response.json()["detail"] == "Nieprawidłowy email lub hasło"


def test_login_survives_corrupted_password_hash(client, db, user):
    user.hashed_password = "to-nie-jest-hash"
    db.add(user)
    db.commit()

    response = client.post("/auth/login", data={"username": user.email, "password": PASSWORD})

    assert response.status_code == 400


def _token(**claims) -> str:
    settings = get_settings()
    secret = claims.pop("secret", settings.secret_key)
    payload = {"exp": datetime.now(UTC) + timedelta(minutes=5), **claims}
    return jwt.encode(payload, secret, algorithm=settings.algorithm)


@pytest.mark.parametrize(
    "make_header",
    [
        pytest.param(lambda email: None, id="brak-naglowka"),
        pytest.param(lambda email: "Bearer to.nie.jwt", id="smieci"),
        pytest.param(lambda email: f"Basic {_token(sub=email)}", id="zly-schemat"),
        pytest.param(
            lambda email: f"Bearer {_token(sub=email, secret='inny-klucz-0123456789-0123456789')}",
            id="obcy-klucz",
        ),
        pytest.param(
            lambda email: f"Bearer {_token(sub=email, exp=datetime.now(UTC) - timedelta(minutes=1))}",
            id="wygasly",
        ),
        pytest.param(lambda email: f"Bearer {_token(sub='nikt@example.com')}", id="nieznany-user"),
        pytest.param(lambda email: f"Bearer {_token(sub=123)}", id="sub-nie-jest-tekstem"),
        pytest.param(lambda email: f"Bearer {_token()}", id="brak-sub"),
    ],
)
def test_me_rejects_invalid_token(client, user, make_header):
    header = make_header(user.email)
    headers = {"Authorization": header} if header else {}

    assert client.get("/auth/me", headers=headers).status_code == 401


def test_token_stops_working_when_user_is_deleted(client, db, user):
    headers = {"Authorization": f"Bearer {create_access_token(user)}"}
    assert client.get("/auth/me", headers=headers).status_code == 200

    db.delete(user)
    db.commit()

    assert client.get("/auth/me", headers=headers).status_code == 401


def test_me_reflects_role_change_without_new_token(client, db, user):
    headers = {"Authorization": f"Bearer {create_access_token(user)}"}
    user.role = "specialist"
    db.add(user)
    db.commit()

    assert client.get("/auth/me", headers=headers).json()["role"] == "specialist"
