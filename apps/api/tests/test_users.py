import pytest

from app import models as m

from .conftest import PASSWORD, assert_login_required, call

ROUTES = [("PATCH", "/users/me"), ("POST", "/users/me/password")]


@pytest.mark.parametrize(("method", "path"), ROUTES)
def test_access(as_role, method, path):
    role, client = as_role
    assert_login_required(role, call(client, method, path).status_code)


@pytest.mark.parametrize("sector", [None, *(sector.value for sector in m.SectorEnum)])
def test_profile_accepts_every_sector(user_client, sector):
    response = user_client.patch("/users/me", json={"sector": sector})

    assert response.status_code == 200
    assert response.json()["sector"] == sector


@pytest.mark.parametrize(
    ("sent", "stored"),
    [("  Fundacja Dobra  ", "Fundacja Dobra"), ("", None), ("   ", None)],
)
def test_profile_trims_text_fields(user_client, sent, stored):
    body = user_client.patch(
        "/users/me", json={"organization": sent, "mentor_bio": sent}
    ).json()

    assert body["organization"] == stored
    assert body["mentor_bio"] == stored


def test_profile_update_replaces_omitted_fields(user_client):
    user_client.patch("/users/me", json={"sector": "ngo", "organization": "Fundacja"})

    body = user_client.patch("/users/me", json={"organization": "Stowarzyszenie"}).json()

    # PATCH działa jak zapis całego formularza profilu — pominięty sektor jest czyszczony
    assert body["sector"] is None
    assert body["organization"] == "Stowarzyszenie"


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"sector": "wojsko"}, id="nieznany-sektor"),
        pytest.param({"organization": "x" * (m.ORGANIZATION_MAX + 1)}, id="organizacja-za-dluga"),
        pytest.param({"mentor_bio": "x" * (m.MENTOR_BIO_MAX + 1)}, id="bio-za-dlugie"),
        pytest.param({"role": "admin"}, id="proba-zmiany-roli"),
        pytest.param({"email": "przejete@example.com"}, id="proba-zmiany-emaila"),
    ],
)
def test_profile_rejects_invalid_payload(user_client, db, user, payload):
    assert user_client.patch("/users/me", json=payload).status_code == 422

    db.refresh(user)
    assert user.role == m.RoleEnum.USER
    assert user.email == "user@example.com"


def test_password_change_switches_credentials(client, user_client, user):
    new_password = "nowe-lepsze-haslo"

    response = user_client.post(
        "/users/me/password", json={"current_password": PASSWORD, "new_password": new_password}
    )

    assert response.status_code == 204
    login = lambda password: client.post(  # noqa: E731
        "/auth/login", data={"username": user.email, "password": password}
    ).status_code
    assert login(PASSWORD) == 400
    assert login(new_password) == 200


@pytest.mark.parametrize(
    ("payload", "status", "detail"),
    [
        pytest.param(
            {"current_password": "nie-to-haslo", "new_password": "nowe-lepsze-haslo"},
            400,
            "Nieprawidłowe obecne hasło",
            id="zle-obecne",
        ),
        pytest.param(
            {"current_password": PASSWORD, "new_password": PASSWORD},
            400,
            "Nowe hasło musi różnić się od obecnego",
            id="takie-samo",
        ),
        pytest.param(
            {"current_password": PASSWORD, "new_password": "krotkie"}, 422, None, id="za-krotkie"
        ),
        pytest.param(
            {"current_password": PASSWORD, "new_password": "x" * 201}, 422, None, id="za-dlugie"
        ),
        pytest.param({"new_password": "nowe-lepsze-haslo"}, 422, None, id="brak-obecnego"),
        pytest.param(
            {"current_password": PASSWORD, "new_password": "nowe-lepsze-haslo", "x": 1},
            422,
            None,
            id="nadmiarowe-pole",
        ),
    ],
)
def test_password_change_rejections_keep_old_password(
    client, user_client, user, payload, status, detail
):
    response = user_client.post("/users/me/password", json=payload)

    assert response.status_code == status
    if detail:
        assert response.json()["detail"] == detail
    still_valid = client.post("/auth/login", data={"username": user.email, "password": PASSWORD})
    assert still_valid.status_code == 200
