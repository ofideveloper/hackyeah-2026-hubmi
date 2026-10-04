import uuid
from datetime import date, timedelta

import pytest
from sqlmodel import select

from app import models as m

from .conftest import ANY_ID, assert_admin_only, assert_login_required, call

USER_ROUTES = [
    ("GET", f"/grant-calls/{ANY_ID}/application"),
    ("PUT", f"/grant-calls/{ANY_ID}/application"),
]
ADMIN_ROUTES = [
    ("GET", "/admin/grant-calls"),
    ("POST", "/admin/grant-calls"),
    ("PATCH", f"/admin/grant-calls/{ANY_ID}"),
    ("DELETE", f"/admin/grant-calls/{ANY_ID}"),
    ("GET", f"/admin/grant-calls/{ANY_ID}/applications"),
]

ANSWERS = {"q1": "Wsparcie opiekunów", "q2": "20 tys. zł"}


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


def call_payload(**changes):
    return {
        "title": "Nabór wiosenny",
        "opens_on": day(-1),
        "closes_on": day(7),
        "questions": [{"label": "Cel projektu"}, {"label": "Budżet", "hint": "w zł"}],
        **changes,
    }


@pytest.mark.parametrize(("method", "path"), USER_ROUTES)
def test_user_access(as_role, method, path):
    role, client = as_role
    assert_login_required(role, call(client, method, path).status_code)


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_access(as_role, method, path):
    role, client = as_role
    assert_admin_only(role, call(client, method, path).status_code)


# --- nabory -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("opens_in", "closes_in", "is_open"),
    [
        pytest.param(-5, 5, True, id="w-trakcie"),
        pytest.param(0, 0, True, id="jednodniowy-dzis"),
        pytest.param(-5, 0, True, id="ostatni-dzien"),
        pytest.param(0, 5, True, id="pierwszy-dzien"),
        pytest.param(1, 5, False, id="jeszcze-nie-otwarty"),
        pytest.param(-5, -1, False, id="zakonczony"),
    ],
)
def test_public_list_shows_only_calls_open_today(
    client, admin_client, make_grant_call, opens_in, closes_in, is_open
):
    grant_call = make_grant_call(opens_in, closes_in)

    public = client.get("/grant-calls").json()
    [for_admin] = admin_client.get("/admin/grant-calls").json()

    assert [row["id"] for row in public] == ([str(grant_call.id)] if is_open else [])
    assert for_admin["is_open"] is is_open
    assert all(row["applications_submitted"] is None for row in public)


def test_admin_creates_call_with_generated_question_keys(admin_client):
    response = admin_client.post(
        "/admin/grant-calls",
        json=call_payload(
            title="  Nabór wiosenny  ",
            questions=[
                {"label": "  Cel projektu  "},
                {"key": "budzet", "label": "Budżet"},
                {"key": "budzet", "label": "Budżet po raz drugi"},
                {"key": "q1", "label": "Harmonogram"},
            ],
        ),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Nabór wiosenny"
    assert body["applications_submitted"] == 0
    keys = [question["key"] for question in body["questions"]]
    assert len(set(keys)) == 4, "klucze pytań muszą być unikalne"
    assert keys[1] == "budzet" and keys[3] == "q1"
    assert body["questions"][0]["label"] == "Cel projektu"


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"closes_on": day(-2)}, id="koniec-przed-poczatkiem"),
        pytest.param({"questions": []}, id="bez-pytan"),
        pytest.param({"questions": [{"label": "Pytanie"}] * 21}, id="21-pytan"),
        pytest.param({"questions": [{"label": "P"}]}, id="etykieta-za-krotka"),
        pytest.param({"questions": [{"label": "Pytanie", "hint": "x" * 501}]}, id="podpowiedz-za-dluga"),
        pytest.param({"title": "N"}, id="tytul-za-krotki"),
        pytest.param({"description": "x" * 4001}, id="opis-za-dlugi"),
        pytest.param({"opens_on": "wczoraj"}, id="zla-data"),
    ],
)
@pytest.mark.parametrize("method", ["POST", "PATCH"])
def test_call_rejects_invalid_payload(admin_client, make_grant_call, method, change):
    path = "/admin/grant-calls" + ("" if method == "POST" else f"/{make_grant_call().id}")

    assert admin_client.request(method, path, json=call_payload(**change)).status_code == 422


def test_admin_updates_call(admin_client, make_grant_call):
    grant_call = make_grant_call()

    response = admin_client.patch(
        f"/admin/grant-calls/{grant_call.id}", json=call_payload(title="Po zmianie", closes_on=day(30))
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Po zmianie"
    assert response.json()["closes_on"] == day(30)


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
def test_unknown_call(admin_client, method):
    response = admin_client.request(
        method, f"/admin/grant-calls/{uuid.uuid4()}", json=call_payload()
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("submit", "status", "calls_left", "applications_left"),
    [
        pytest.param(False, 204, 0, 0, id="szkice-znikaja-z-naborem"),
        pytest.param(True, 409, 1, 1, id="zlozony-wniosek-blokuje"),
    ],
)
def test_delete_call_depends_on_submitted_applications(
    admin_client, user_client, db, make_grant_call, submit, status, calls_left, applications_left
):
    grant_call = make_grant_call()
    user_client.put(
        f"/grant-calls/{grant_call.id}/application", json={"answers": ANSWERS, "submit": submit}
    )

    assert admin_client.delete(f"/admin/grant-calls/{grant_call.id}").status_code == status

    assert len(db.exec(select(m.GrantCall)).all()) == calls_left
    assert len(db.exec(select(m.GrantApplication)).all()) == applications_left


# --- wniosek ----------------------------------------------------------------


def test_application_is_empty_until_first_save(user_client, make_grant_call):
    response = user_client.get(f"/grant-calls/{make_grant_call().id}/application")

    assert response.status_code == 200
    assert response.json() is None


def test_draft_can_be_saved_partially_and_resumed(user_client, user, make_grant_call, make_idea):
    grant_call, idea = make_grant_call(), make_idea(user, name="Klub sąsiedzki")
    path = f"/grant-calls/{grant_call.id}/application"

    first = user_client.put(path, json={"answers": {"q1": "  Szkic celu  ", "q2": "   "}})
    second = user_client.put(path, json={"answers": ANSWERS, "idea_id": str(idea.id)})

    assert first.status_code == 200
    assert first.json()["status"] == "szkic"
    assert first.json()["answers"] == {"q1": "Szkic celu"}
    assert second.json()["id"] == first.json()["id"], "jeden wniosek na osobę i nabór"
    assert second.json()["idea_title"] == "Klub sąsiedzki"
    assert user_client.get(path).json()["answers"] == ANSWERS


def test_submitted_application_is_final(user_client, make_grant_call):
    path = f"/grant-calls/{make_grant_call().id}/application"

    submitted = user_client.put(path, json={"answers": ANSWERS, "submit": True})
    changed = user_client.put(path, json={"answers": {"q1": "Inna odpowiedź"}})

    assert submitted.json()["status"] == "zlozony"
    assert submitted.json()["submitted_at"] is not None
    assert changed.status_code == 409
    assert user_client.get(path).json()["answers"] == ANSWERS


@pytest.mark.parametrize(
    ("payload", "detail"),
    [
        pytest.param(
            {"answers": {"q1": "Cel"}, "submit": True}, "Uzupełnij wszystkie pola", id="niepelny"
        ),
        pytest.param(
            {"answers": {**ANSWERS, "q2": "  "}, "submit": True},
            "Uzupełnij wszystkie pola",
            id="odpowiedz-ze-spacji",
        ),
        pytest.param({"answers": {"q9": "x"}}, "spoza formularza", id="nieznane-pytanie"),
        pytest.param(
            {"answers": {"q1": "x" * (m.GRANT_ANSWER_MAX + 1)}}, "może mieć do", id="za-dluga"
        ),
    ],
)
def test_application_rejects_invalid_answers(user_client, db, make_grant_call, payload, detail):
    response = user_client.put(f"/grant-calls/{make_grant_call().id}/application", json=payload)

    assert response.status_code == 422
    assert detail in response.json()["detail"]
    assert db.exec(select(m.GrantApplication)).all() == []


@pytest.mark.parametrize(("opens_in", "closes_in"), [(1, 5), (-5, -1)])
def test_application_needs_open_call(user_client, make_grant_call, opens_in, closes_in):
    grant_call = make_grant_call(opens_in, closes_in)

    response = user_client.put(f"/grant-calls/{grant_call.id}/application", json={"answers": ANSWERS})

    assert response.status_code == 409


@pytest.mark.parametrize("method", ["GET", "PUT"])
def test_application_for_unknown_call(user_client, method):
    response = user_client.request(
        method, f"/grant-calls/{uuid.uuid4()}/application", json={"answers": {}}
    )

    assert response.status_code == 404


def test_application_cannot_reference_someone_elses_idea(
    user_client, other_user, make_grant_call, make_idea
):
    foreign = make_idea(other_user, "approved")

    response = user_client.put(
        f"/grant-calls/{make_grant_call().id}/application",
        json={"answers": ANSWERS, "idea_id": str(foreign.id)},
    )

    assert response.status_code == 404


def test_users_do_not_see_each_others_applications(user_client, other_client, make_grant_call):
    path = f"/grant-calls/{make_grant_call().id}/application"
    user_client.put(path, json={"answers": ANSWERS})

    assert other_client.get(path).json() is None


def test_admin_sees_only_submitted_applications_with_author(
    admin_client, user_client, other_client, user, make_grant_call
):
    grant_call = make_grant_call()
    path = f"/grant-calls/{grant_call.id}/application"
    user_client.put(path, json={"answers": ANSWERS, "submit": True})
    other_client.put(path, json={"answers": ANSWERS})  # szkic — prywatny

    rows = admin_client.get(f"/admin/grant-calls/{grant_call.id}/applications").json()
    [listed] = admin_client.get("/admin/grant-calls").json()

    assert [row["author_email"] for row in rows] == [user.email]
    assert rows[0]["author_name"] == "Ula Zwykła"
    assert listed["applications_submitted"] == 1
