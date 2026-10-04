import uuid

import pytest
from sqlmodel import select

from app import models as m

from .conftest import ANY_ID, assert_admin_only, assert_login_required, call

USER_ROUTES = [
    ("GET", "/testing/mine"),
    ("POST", f"/testing/solutions/innowacja/{ANY_ID}/signups"),
    ("DELETE", f"/testing/signups/{ANY_ID}"),
    ("PUT", f"/testing/solutions/innowacja/{ANY_ID}/review"),
    ("DELETE", f"/testing/solutions/innowacja/{ANY_ID}/review"),
]
ADMIN_ROUTES = [
    ("GET", "/admin/testing/signups"),
    ("PATCH", f"/admin/testing/signups/{ANY_ID}"),
    ("GET", "/admin/testing/reviews"),
    ("DELETE", f"/admin/testing/reviews/{ANY_ID}"),
]


@pytest.mark.parametrize(("method", "path"), USER_ROUTES)
def test_user_access(as_role, method, path):
    role, client = as_role
    assert_login_required(role, call(client, method, path).status_code)


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_access(as_role, method, path):
    role, client = as_role
    assert_admin_only(role, call(client, method, path).status_code)


@pytest.fixture(params=["innowacja", "pomysl"])
def solution(request, user, make_project, make_idea):
    """Każdy test z tym fixture'em leci dla obu rodzajów rozwiązań."""
    if request.param == "innowacja":
        return make_project(name="Teleopieka domowa")
    return make_idea(user, "approved", name="Klub sąsiedzki")


def path_for(target, suffix: str = "") -> str:
    kind = "pomysl" if isinstance(target, m.ProposalOfNewProject) else "innowacja"
    return f"/testing/solutions/{kind}/{target.id}{suffix}"


# --- lista rozwiązań --------------------------------------------------------


@pytest.mark.parametrize(
    ("status", "listed"), [("approved", True), ("pending", False), ("rejected", False)]
)
def test_solutions_include_only_approved_ideas(client, user, make_idea, make_project, status, listed):
    make_project(name="Teleopieka domowa")
    make_idea(user, status, name="Klub sąsiedzki")

    rows = client.get("/testing/solutions").json()

    assert [(row["kind"], row["name"]) for row in rows] == (
        [("pomysl", "Klub sąsiedzki")] if listed else []
    ) + [("innowacja", "Teleopieka domowa")]


def test_solution_stats_average_ratings_and_count_distinct_active_testers(
    client, make_user, solution, make_signup, make_review
):
    testers = [make_user() for _ in range(4)]
    make_signup(testers[0], solution, "approved")
    make_signup(testers[0], solution, "pending")  # ta sama osoba, druga tura
    make_signup(testers[1], solution, "pending")
    make_signup(testers[2], solution, "rejected")
    for tester, rating in zip(testers[:3], (5, 4, 4)):
        make_review(tester, solution, rating)

    [row] = client.get("/testing/solutions").json()

    assert row["testers_count"] == 2
    assert row["reviews_count"] == 3
    assert row["rating_avg"] == 4.3


def test_solution_without_reviews_has_no_rating(client, solution):
    [row] = client.get("/testing/solutions").json()

    assert (row["rating_avg"], row["reviews_count"], row["testers_count"]) == (None, 0, 0)


@pytest.mark.parametrize(
    ("description", "summary"),
    [
        pytest.param("Krótki opis.", "Krótki opis.", id="krotki"),
        pytest.param("1. Na czym polega\nOpaska SOS.\n2. Problem\nSamotność.", "Opaska SOS.", id="pierwsza-sekcja"),
        pytest.param("słowo " * 100, ("słowo " * 66).strip() + "…", id="przyciety-do-400-znakow"),
    ],
)
def test_solution_summary(client, make_project, description, summary):
    make_project(description=description)

    assert client.get("/testing/solutions").json()[0]["summary"] == summary


# --- zgłoszenia -------------------------------------------------------------


def test_signup_is_created_as_pending(user_client, solution):
    response = user_client.post(
        path_for(solution, "/signups"), json={"motivation": "  Prowadzę klub seniora.  "}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["motivation"] == "Prowadzę klub seniora."
    assert body["target_name"] == solution.name
    assert [row["id"] for row in user_client.get("/testing/mine").json()["signups"]] == [body["id"]]


def test_signup_can_be_repeated_for_next_round(user_client, db, solution):
    for _ in range(2):
        assert user_client.post(path_for(solution, "/signups"), json={}).status_code == 201

    assert len(db.exec(select(m.TesterSignup)).all()) == 2


@pytest.mark.parametrize("status", ["pending", "rejected"])
def test_signup_for_unapproved_idea_is_not_possible(user_client, other_user, make_idea, status):
    idea = make_idea(other_user, status)

    assert user_client.post(path_for(idea, "/signups"), json={}).status_code == 404


@pytest.mark.parametrize(
    ("path", "payload", "status"),
    [
        pytest.param(f"/testing/solutions/innowacja/{uuid.uuid4()}/signups", {}, 404, id="nieznana-innowacja"),
        pytest.param(f"/testing/solutions/pomysl/{uuid.uuid4()}/signups", {}, 404, id="nieznany-pomysl"),
        pytest.param(f"/testing/solutions/usluga/{ANY_ID}/signups", {}, 422, id="nieznany-rodzaj"),
        pytest.param("/testing/solutions/innowacja/abc/signups", {}, 422, id="zle-id"),
    ],
)
def test_signup_rejects_bad_target(user_client, path, payload, status):
    assert user_client.post(path, json=payload).status_code == status


def test_signup_motivation_has_length_limit(user_client, solution):
    response = user_client.post(
        path_for(solution, "/signups"), json={"motivation": "x" * (m.TESTER_MOTIVATION_MAX + 1)}
    )

    assert response.status_code == 422


def test_innovation_id_is_not_accepted_as_idea(user_client, make_project):
    project = make_project()

    response = user_client.post(f"/testing/solutions/pomysl/{project.id}/signups", json={})

    assert response.status_code == 404


def test_withdraw_own_signup(user_client, db, user, solution, make_signup):
    signup = make_signup(user, solution)

    assert user_client.delete(f"/testing/signups/{signup.id}").status_code == 204
    assert db.exec(select(m.TesterSignup)).all() == []


@pytest.mark.parametrize("target", ["cudze", "nieistniejace"])
def test_withdraw_someone_elses_signup_is_reported_as_missing(
    other_client, db, user, solution, make_signup, target
):
    signup = make_signup(user, solution)
    signup_id = signup.id if target == "cudze" else uuid.uuid4()

    assert other_client.delete(f"/testing/signups/{signup_id}").status_code == 404
    assert len(db.exec(select(m.TesterSignup)).all()) == 1


# --- opinie -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("signup_status", "status"),
    [(None, 403), ("pending", 403), ("rejected", 403), ("approved", 200)],
)
def test_only_accepted_tester_can_review(
    user_client, db, user, solution, make_signup, signup_status, status
):
    if signup_status:
        make_signup(user, solution, signup_status)

    response = user_client.put(path_for(solution, "/review"), json={"rating": 5})

    assert response.status_code == status
    assert len(db.exec(select(m.SolutionReview)).all()) == (1 if status == 200 else 0)


def test_acceptance_for_one_solution_does_not_cover_another(
    user_client, user, make_project, make_signup
):
    tested, other = make_project(), make_project()
    make_signup(user, tested, "approved")

    assert user_client.put(path_for(other, "/review"), json={"rating": 5}).status_code == 403


@pytest.mark.parametrize(
    ("payload", "status"),
    [
        pytest.param({"rating": 1}, 200, id="ocena-1"),
        pytest.param({"rating": 5}, 200, id="ocena-5"),
        pytest.param({"rating": 0}, 422, id="ocena-0"),
        pytest.param({"rating": 6}, 422, id="ocena-6"),
        pytest.param({"rating": 4.5}, 422, id="ocena-ulamkowa"),
        pytest.param({"rating": "pięć"}, 422, id="ocena-tekstem"),
        pytest.param({}, 422, id="brak-oceny"),
        pytest.param({"rating": 5, "feedback": "x" * m.REVIEW_TEXT_MAX}, 200, id="opinia-na-granicy"),
        pytest.param({"rating": 5, "feedback": "x" * (m.REVIEW_TEXT_MAX + 1)}, 422, id="opinia-za-dluga"),
        pytest.param({"rating": 5, "improvement": "x" * (m.REVIEW_TEXT_MAX + 1)}, 422, id="usprawnienie-za-dlugie"),
    ],
)
def test_review_validation(user_client, user, solution, make_signup, payload, status):
    make_signup(user, solution, "approved")

    assert user_client.put(path_for(solution, "/review"), json=payload).status_code == status


def test_second_review_updates_the_first(user_client, db, user, solution, make_signup):
    make_signup(user, solution, "approved")
    path = path_for(solution, "/review")

    first = user_client.put(path, json={"rating": 2, "feedback": "  Słabo  "}).json()
    second = user_client.put(path, json={"rating": 5, "improvement": "Krótsza instrukcja"}).json()

    assert second["id"] == first["id"]
    assert (second["rating"], second["feedback"], second["improvement"]) == (
        5,
        "",
        "Krótsza instrukcja",
    )
    assert first["feedback"] == "Słabo"
    assert second["updated_at"] > first["updated_at"]
    assert second["created_at"] == first["created_at"]
    assert len(db.exec(select(m.SolutionReview)).all()) == 1


def test_public_reviews_hide_author_contact(client, user, other_user, solution, make_review):
    make_review(user, solution, 5, feedback="Działa")
    make_review(other_user, solution, 3)

    rows = client.get(path_for(solution, "/reviews")).json()

    assert {row["author_name"] for row in rows} == {"Ula Z.", "Olek I."}
    assert all("author_email" not in row and "author_full_name" not in row for row in rows)


@pytest.mark.parametrize("kind", ["innowacja", "pomysl"])
def test_reviews_for_unknown_solution(client, kind):
    assert client.get(f"/testing/solutions/{kind}/{uuid.uuid4()}/reviews").status_code == 404


def test_my_testing_lists_only_own_items(
    user_client, user, other_user, solution, make_signup, make_review
):
    make_signup(user, solution, "approved")
    make_review(user, solution, 4)
    make_signup(other_user, solution)
    make_review(other_user, solution, 1)

    body = user_client.get("/testing/mine").json()

    assert [(s["status"], s["target_name"]) for s in body["signups"]] == [("approved", solution.name)]
    assert [r["rating"] for r in body["reviews"]] == [4]


def test_delete_own_review(user_client, db, user, other_user, solution, make_review):
    make_review(user, solution)
    kept = make_review(other_user, solution)

    assert user_client.delete(path_for(solution, "/review")).status_code == 204
    assert [review.id for review in db.exec(select(m.SolutionReview)).all()] == [kept.id]
    # drugiego usunięcia już nie ma czego dotyczyć
    assert user_client.delete(path_for(solution, "/review")).status_code == 404


# --- moderacja --------------------------------------------------------------


@pytest.mark.parametrize("start", [status.value for status in m.StatusEnum])
@pytest.mark.parametrize("target", [status.value for status in m.StatusEnum])
def test_admin_sets_any_signup_status(admin_client, db, user, solution, make_signup, start, target):
    signup = make_signup(user, solution, start)

    response = admin_client.patch(f"/admin/testing/signups/{signup.id}", json={"status": target})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == target
    assert body["tester_email"] == user.email
    assert body["tester_full_name"] == "Ula Zwykła"


@pytest.mark.parametrize(
    ("payload", "status"),
    [({"status": "przyjete"}, 422), ({}, 422), ({"status": None}, 422)],
)
def test_admin_signup_decision_validation(admin_client, user, solution, make_signup, payload, status):
    signup = make_signup(user, solution)

    response = admin_client.patch(f"/admin/testing/signups/{signup.id}", json=payload)

    assert response.status_code == status


@pytest.mark.parametrize(
    ("method", "path"),
    [("PATCH", "/admin/testing/signups/{id}"), ("DELETE", "/admin/testing/reviews/{id}")],
)
def test_admin_unknown_item(admin_client, method, path):
    response = admin_client.request(
        method, path.format(id=uuid.uuid4()), json={"status": "approved"}
    )

    assert response.status_code == 404


def test_revoking_acceptance_blocks_further_reviews(
    admin_client, user_client, user, solution, make_signup
):
    signup = make_signup(user, solution, "approved")
    assert user_client.put(path_for(solution, "/review"), json={"rating": 4}).status_code == 200

    admin_client.patch(f"/admin/testing/signups/{signup.id}", json={"status": "rejected"})

    assert user_client.put(path_for(solution, "/review"), json={"rating": 1}).status_code == 403


def test_admin_lists_and_removes_reviews(admin_client, db, user, solution, make_review):
    review = make_review(user, solution, 1, feedback="Spam")

    [row] = admin_client.get("/admin/testing/reviews").json()
    assert row["author_email"] == user.email
    assert row["target_name"] == solution.name

    assert admin_client.delete(f"/admin/testing/reviews/{review.id}").status_code == 204
    assert db.exec(select(m.SolutionReview)).all() == []


def test_names_survive_deleted_target(admin_client, db, user, make_project, make_signup):
    project = make_project()
    make_signup(user, project)
    db.delete(project)
    db.commit()

    [row] = admin_client.get("/admin/testing/signups").json()

    assert row["target_name"] is None
