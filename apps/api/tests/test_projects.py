import uuid

import pytest

from app import models as m

from .conftest import assert_admin_only, assert_login_required, call


def test_catalog_access(as_role):
    role, client = as_role
    assert_admin_only(role, call(client, "POST", "/actual-projects").status_code)


def test_proposal_access(as_role):
    role, client = as_role
    assert_login_required(role, call(client, "POST", "/project-proposals").status_code)


def test_admin_adds_innovation_to_catalog(admin_client, category, db):
    response = admin_client.post(
        "/actual-projects",
        json={
            "category_id": str(category.id),
            "name": "Teleopieka",
            "description": "Opaska SOS.",
            "source_url": "https://example.org/teleopieka",
        },
    )

    assert response.status_code == 201
    stored = db.get(m.ActualProject, uuid.UUID(response.json()["id"]))
    assert stored.name == "Teleopieka"
    assert stored.category_id == category.id


def test_innovation_needs_existing_category(admin_client):
    response = admin_client.post(
        "/actual-projects",
        json={"category_id": str(uuid.uuid4()), "name": "Teleopieka", "description": "Opis"},
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"name": ""}, id="pusta-nazwa"),
        pytest.param({"name": None}, id="brak-nazwy"),
        pytest.param({"description": None}, id="brak-opisu"),
        pytest.param({"category_id": "to-nie-uuid"}, id="zle-id-kategorii"),
    ],
)
def test_innovation_rejects_invalid_payload(admin_client, category, change):
    payload = {"category_id": str(category.id), "name": "Teleopieka", "description": "Opis"}
    payload = {key: value for key, value in {**payload, **change}.items() if value is not None}

    assert admin_client.post("/actual-projects", json=payload).status_code == 422


def test_user_proposal_goes_to_admin_queue(user_client, admin_client, user):
    response = user_client.post(
        "/project-proposals",
        json={"name": "  Wypożyczalnia wózków  ", "description": "  Brakuje w gminie.  "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Wypożyczalnia wózków"
    assert body["description"] == "Brakuje w gminie."
    assert body["status"] == "nowe"
    assert body["author_id"] == str(user.id)
    assert [row["id"] for row in admin_client.get("/admin/project-proposals").json()] == [body["id"]]


@pytest.mark.parametrize(
    "extra",
    [
        pytest.param({"status": "zaakceptowane"}, id="wlasny-status"),
        pytest.param({"author_id": "00000000-0000-4000-8000-000000000001"}, id="cudzy-autor"),
    ],
)
def test_proposal_ignores_fields_owned_by_the_server(user_client, user, extra):
    body = user_client.post(
        "/project-proposals", json={"name": "Nazwa", "description": "Opis", **extra}
    ).json()

    assert body["status"] == "nowe"
    assert body["author_id"] == str(user.id)


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"name": "N", "description": "Opis"}, id="nazwa-1-znak"),
        pytest.param({"name": "x" * 256, "description": "Opis"}, id="nazwa-256-znakow"),
        pytest.param({"name": "Nazwa", "description": "O"}, id="opis-1-znak"),
        pytest.param({"name": "Nazwa", "description": "x" * 5001}, id="opis-5001-znakow"),
        pytest.param({"name": "Nazwa"}, id="brak-opisu"),
        pytest.param({}, id="puste"),
    ],
)
def test_proposal_rejects_invalid_payload(user_client, payload):
    assert user_client.post("/project-proposals", json=payload).status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"name": "x" * 255, "description": "Opis"}, id="nazwa-255-znakow"),
        pytest.param({"name": "Na", "description": "x" * 5000}, id="opis-5000-znakow"),
    ],
)
def test_proposal_accepts_boundary_lengths(user_client, payload):
    assert user_client.post("/project-proposals", json=payload).status_code == 201
