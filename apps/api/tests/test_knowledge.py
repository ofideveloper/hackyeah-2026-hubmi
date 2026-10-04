import uuid
from datetime import datetime, timedelta

import pytest

from app import models as m
from app.routes.knowledge import split_sections

from .conftest import ANY_ID, assert_admin_only, call

ADMIN_ROUTES = [
    ("POST", "/admin/knowledge/resources"),
    ("PATCH", f"/admin/knowledge/resources/{ANY_ID}"),
    ("DELETE", f"/admin/knowledge/resources/{ANY_ID}"),
    ("POST", "/admin/knowledge/refresh"),
    ("GET", "/admin/trends"),
]

RESOURCE = {"kind": "material", "title": "Poradnik", "format": "PDF", "url": "https://example.org/p"}


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_access(as_role, method, path):
    role, client = as_role
    assert_admin_only(role, call(client, method, path).status_code)


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        pytest.param("", [], id="pusty"),
        pytest.param("Sam opis bez nagłówków.", [("", "Sam opis bez nagłówków.")], id="bez-sekcji"),
        pytest.param(
            "1. Na czym polega\nOpaska SOS.\n2. Jakich problemów dotyczy\nSamotność.",
            [("Na czym polega", "Opaska SOS."), ("Jakich problemów dotyczy", "Samotność.")],
            id="dwie-sekcje",
        ),
        pytest.param(
            "Wstęp.\n1. Na czym polega\nTreść.",
            [("", "Wstęp."), ("Na czym polega", "Treść.")],
            id="wstep-przed-sekcja",
        ),
        pytest.param(
            "1. Kroki\n1. ab\n2. Drugi krok wdrożenia",
            [("Kroki", "1. ab"), ("Drugi krok wdrożenia", "")],
            id="za-krotki-naglowek-zostaje-trescia",
        ),
    ],
)
def test_split_sections(description, expected):
    assert [(s.title, s.body) for s in split_sections(description)] == expected


def test_overview_is_public_and_counts_innovations_per_area(client, catalog, make_category):
    make_category("Pusty obszar")

    response = client.get("/knowledge")

    assert response.status_code == 200
    body = response.json()
    assert {area["name"]: area["innovations"] for area in body["areas"]} == {
        "Dla młodzieży": 1,
        "Dla seniorów": 2,
        "Pusty obszar": 0,
    }
    assert [row["name"] for row in body["innovations"]] == [
        "Klub sąsiedzki",
        "Mobilny streetworker",
        "Teleopieka domowa",
    ]


@pytest.mark.parametrize(("video_url", "has_video"), [("https://youtu.be/x", True), (None, False)])
def test_innovation_summary_and_detail(client, make_project, category, video_url, has_video):
    project = make_project(
        category,
        description="1. Na czym polega\nOpaska SOS.\n2. Jakich problemów dotyczy\nSamotność.",
        video_url=video_url,
    )

    [summary] = client.get("/knowledge").json()["innovations"]
    detail = client.get(f"/knowledge/innovations/{project.id}").json()

    assert (summary["solution"], summary["problem"]) == ("Opaska SOS.", "Samotność.")
    assert summary["has_video"] is has_video
    assert detail["category_name"] == category.name
    assert [section["title"] for section in detail["sections"]] == [
        "Na czym polega",
        "Jakich problemów dotyczy",
    ]
    assert detail["video_url"] == video_url


def test_unknown_innovation(client):
    assert client.get(f"/knowledge/innovations/{uuid.uuid4()}").status_code == 404


def test_resource_lifecycle_is_visible_in_public_overview(admin_client, client, category):
    created = admin_client.post(
        "/admin/knowledge/resources", json={**RESOURCE, "category_id": str(category.id)}
    )
    assert created.status_code == 201
    resource_id = created.json()["id"]
    assert [r["title"] for r in client.get("/knowledge").json()["resources"]] == ["Poradnik"]

    updated = admin_client.patch(
        f"/admin/knowledge/resources/{resource_id}", json={**RESOURCE, "title": "Poradnik 2.0"}
    )
    assert updated.json()["title"] == "Poradnik 2.0"
    assert updated.json()["category_id"] is None
    assert updated.json()["updated_at"] >= created.json()["updated_at"]

    assert admin_client.delete(f"/admin/knowledge/resources/{resource_id}").status_code == 204
    assert client.get("/knowledge").json()["resources"] == []


@pytest.mark.parametrize(
    ("url", "status", "stored"),
    [
        ("https://example.org/a", 201, "https://example.org/a"),
        ("http://example.org/a", 201, "http://example.org/a"),
        ("  HTTPS://example.org/a  ", 201, "HTTPS://example.org/a"),
        ("", 201, None),
        (None, 201, None),
        ("javascript:alert(1)", 422, None),
        ("  JavaScript:alert(1)", 422, None),
        ("data:text/html,<script>alert(1)</script>", 422, None),
        ("ftp://example.org/a", 422, None),
        ("//example.org/a", 422, None),
        ("example.org/a", 422, None),
    ],
)
def test_resource_url_must_be_http(admin_client, url, status, stored):
    response = admin_client.post("/admin/knowledge/resources", json={**RESOURCE, "url": url})

    assert response.status_code == status
    if status == 201:
        assert response.json()["url"] == stored


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"kind": "film"}, id="nieznana-sekcja"),
        pytest.param({"title": "P"}, id="tytul-za-krotki"),
        pytest.param({"title": "x" * 256}, id="tytul-za-dlugi"),
        pytest.param({"format": "x" * 41}, id="forma-za-dluga"),
        pytest.param({"summary": "x" * 2001}, id="opis-za-dlugi"),
    ],
)
def test_resource_rejects_invalid_payload(admin_client, change):
    response = admin_client.post("/admin/knowledge/resources", json={**RESOURCE, **change})

    assert response.status_code == 422


@pytest.mark.parametrize("method", ["POST", "PATCH"])
def test_resource_needs_existing_area(admin_client, db, method):
    resource = m.KnowledgeResource(kind="material", title="Poradnik")
    db.add(resource)
    db.commit()
    path = "/admin/knowledge/resources" + ("" if method == "POST" else f"/{resource.id}")

    response = admin_client.request(
        method, path, json={**RESOURCE, "category_id": str(uuid.uuid4())}
    )

    assert response.status_code == 404


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
def test_unknown_resource(admin_client, method):
    response = admin_client.request(
        method, f"/admin/knowledge/resources/{uuid.uuid4()}", json=RESOURCE
    )

    assert response.status_code == 404


@pytest.mark.parametrize("added", [0, 3])
def test_refresh_reports_number_of_new_innovations(admin_client, scraper, added):
    scraper.added = added

    response = admin_client.post("/admin/knowledge/refresh")

    assert response.json() == {"added": added}
    assert scraper.calls == 1


def _signal(db, category=None, days_ago=0, summary=""):
    db.add(
        m.NeedSignal(
            category_id=category.id if category else None,
            summary=summary,
            created_at=(datetime.now() - timedelta(days=days_ago)).isoformat(),
        )
    )
    db.commit()


def test_trends_are_empty_without_signals(admin_client):
    body = admin_client.get("/admin/trends").json()

    assert body["total"] == 0
    assert body["areas"] == [] and body["unmet"] == []
    assert len(body["weeks"]) == 8
    assert body["weeks"] == sorted(body["weeks"])


@pytest.mark.parametrize(
    ("days_ago", "last_30", "previous_30"),
    [(0, 1, 0), (29, 1, 0), (31, 0, 1), (59, 0, 1), (61, 0, 0), (400, 0, 0)],
)
def test_trends_bucket_signals_by_age(admin_client, db, category, days_ago, last_30, previous_30):
    _signal(db, category, days_ago)

    [area] = admin_client.get("/admin/trends").json()["areas"]

    assert area["name"] == category.name
    assert area["total"] == 1
    assert (area["last_30_days"], area["previous_30_days"]) == (last_30, previous_30)
    # Wykres tygodniowy sięga 8 tygodni wstecz — starsze sygnały liczą się tylko do sumy
    if days_ago < 49 or days_ago > 56:
        assert sum(area["weekly"]) == (1 if days_ago < 49 else 0)


def test_trends_rank_areas_and_group_repeating_unmet_needs(admin_client, db, make_category):
    seniors, youth = make_category("Seniorzy"), make_category("Młodzież")
    for _ in range(3):
        _signal(db, youth)
    _signal(db, seniors)
    _signal(db, summary="Wypożyczalnia wózków inwalidzkich w gminie")
    _signal(db, summary="Brakuje wypożyczalni wózków inwalidzkich")
    _signal(db, summary="Nocna świetlica dla młodzieży")

    body = admin_client.get("/admin/trends").json()

    assert body["total"] == 7
    assert [area["name"] for area in body["areas"]] == [
        "Bez odpowiedzi w bazie",
        "Młodzież",
        "Seniorzy",
    ]
    assert body["areas"][0]["category_id"] is None
    similar = {need["summary"]: need["similar"] for need in body["unmet"]}
    assert similar == {
        "Wypożyczalnia wózków inwalidzkich w gminie": 1,
        "Brakuje wypożyczalni wózków inwalidzkich": 1,
        "Nocna świetlica dla młodzieży": 0,
    }
