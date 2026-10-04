import uuid

import pytest

from .conftest import ANY_ID, assert_admin_only, assert_login_required, call

READ_ROUTES = [("GET", "/categories"), ("GET", f"/categories/{ANY_ID}")]
WRITE_ROUTES = [
    ("POST", "/categories"),
    ("PATCH", f"/categories/{ANY_ID}"),
    ("DELETE", f"/categories/{ANY_ID}"),
]


@pytest.mark.parametrize(("method", "path"), READ_ROUTES)
def test_read_access(as_role, method, path):
    role, client = as_role
    assert_login_required(role, call(client, method, path).status_code)


@pytest.mark.parametrize(("method", "path"), WRITE_ROUTES)
def test_write_access(as_role, method, path):
    role, client = as_role
    assert_admin_only(role, call(client, method, path).status_code)


def test_list_is_sorted_by_name(user_client, make_category):
    for name in ("Zdrowie", "Ala", "Młodzież"):
        make_category(name)

    names = [row["name"] for row in user_client.get("/categories").json()]

    assert names == sorted(names)


def test_create_read_rename_delete(admin_client):
    created = admin_client.post("/categories", json={"name": "Dla seniorów"})
    assert created.status_code == 201
    category_id = created.json()["id"]

    assert admin_client.get(f"/categories/{category_id}").json()["name"] == "Dla seniorów"

    renamed = admin_client.patch(f"/categories/{category_id}", json={"name": "Seniorzy"})
    assert renamed.json()["name"] == "Seniorzy"

    assert admin_client.delete(f"/categories/{category_id}").status_code == 204
    assert admin_client.get(f"/categories/{category_id}").status_code == 404


@pytest.mark.parametrize("payload", [{}, {"name": ""}, {"name": None}])
def test_name_is_required(admin_client, payload):
    assert admin_client.post("/categories", json=payload).status_code == 422


def test_duplicate_name_is_rejected_on_create_and_rename(admin_client, make_category):
    make_category("Seniorzy")
    other = make_category("Młodzież")

    assert admin_client.post("/categories", json={"name": "Seniorzy"}).status_code == 409
    assert (
        admin_client.patch(f"/categories/{other.id}", json={"name": "Seniorzy"}).status_code == 409
    )


def test_rename_to_own_name_is_allowed(admin_client, category):
    response = admin_client.patch(f"/categories/{category.id}", json={"name": category.name})

    assert response.status_code == 200


@pytest.mark.parametrize("method", ["GET", "PATCH", "DELETE"])
def test_unknown_category(admin_client, method):
    response = admin_client.request(method, f"/categories/{uuid.uuid4()}", json={"name": "X"})

    assert response.status_code == 404


@pytest.mark.parametrize("used_by", ["project", "idea"])
def test_category_in_use_cannot_be_deleted(
    admin_client, category, user, make_project, make_idea, used_by
):
    if used_by == "project":
        make_project(category)
    else:
        make_idea(user, category=category)

    response = admin_client.delete(f"/categories/{category.id}")

    assert response.status_code == 409
    assert admin_client.get(f"/categories/{category.id}").status_code == 200


@pytest.mark.parametrize("method", ["POST", "PATCH", "DELETE"])
def test_regular_user_cannot_modify_categories(user_client, db, category, method):
    path = "/categories" if method == "POST" else f"/categories/{category.id}"

    response = user_client.request(method, path, json={"name": "Zmienione przez usera"})

    assert response.status_code == 403
    db.refresh(category)
    assert category.name == "Dla seniorów"
    assert [row["name"] for row in user_client.get("/categories").json()] == ["Dla seniorów"]
