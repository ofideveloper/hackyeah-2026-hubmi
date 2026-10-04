import uuid

import pytest

from app import models as m

from .conftest import ANY_ID, assert_admin_only, call

ROUTES = [
    ("GET", "/admin/stats"),
    ("GET", "/admin/inbox"),
    ("GET", "/admin/users"),
    ("PATCH", f"/admin/users/{ANY_ID}"),
    ("GET", "/admin/project-proposals"),
    ("POST", f"/admin/project-proposals/{ANY_ID}/accept"),
    ("POST", f"/admin/project-proposals/{ANY_ID}/reject"),
]


@pytest.mark.parametrize(("method", "path"), ROUTES)
def test_access(as_role, method, path):
    role, client = as_role
    assert_admin_only(role, call(client, method, path).status_code)


@pytest.fixture
def make_proposal(db):
    def factory(author, status=m.ProjectProposalStatus.NEW, name="Wypożyczalnia wózków"):
        proposal = m.ProjectProposal(
            author_id=author.id, name=name, description="Brakuje w gminie.", status=status
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return proposal

    return factory


def test_stats_count_users_by_role(admin_client, user, other_user, specialist):
    assert admin_client.get("/admin/stats").json() == {
        "users_total": 4,
        "users_active": 4,
        "admins_total": 1,
    }


def test_inbox_is_empty_without_pending_work(admin_client):
    assert admin_client.get("/admin/inbox").json() == {
        "ideas": 0,
        "tester_signups": 0,
        "proposals": 0,
        "messages": 0,
    }


def test_inbox_counts_only_items_waiting_for_the_team(
    admin_client,
    admin,
    user,
    specialist,
    catalog,
    make_idea,
    make_signup,
    make_proposal,
    make_conversation,
    db,
):
    make_idea(user, "pending")
    make_idea(user, "pending")
    make_idea(user, "approved")
    make_signup(user, catalog[0], "pending")
    make_signup(user, catalog[0], "rejected")
    make_proposal(user)
    make_proposal(user, m.ProjectProposalStatus.ACCEPTED)
    make_conversation(user)  # pytanie bez odpowiedzi
    make_conversation(user, "mentoring", recipient=specialist)  # nie do zespołu
    closed = make_conversation(user)
    closed.status = m.ConversationStatus.CLOSED
    answered = make_conversation(user)
    answered.last_author_id = admin.id
    db.add_all([closed, answered])
    db.commit()

    assert admin_client.get("/admin/inbox").json() == {
        "ideas": 2,
        "tester_signups": 1,
        "proposals": 1,
        "messages": 1,
    }


def test_users_are_listed_by_email_without_secrets(admin_client, user, other_user):
    body = admin_client.get("/admin/users").json()

    assert [row["email"] for row in body] == sorted(row["email"] for row in body)
    assert {"other@example.com", "user@example.com"} <= {row["email"] for row in body}
    assert all("hashed_password" not in row for row in body)


@pytest.mark.parametrize(
    ("start", "target"),
    [("user", "specialist"), ("specialist", "user"), ("user", "user")],
)
def test_role_change_between_user_and_mentor(admin_client, make_user, db, start, target):
    account = make_user(start)

    response = admin_client.patch(f"/admin/users/{account.id}", json={"role": target})

    assert response.status_code == 200
    assert response.json()["role"] == target
    db.refresh(account)
    assert account.role == m.RoleEnum(target)


@pytest.mark.parametrize("role", ["admin", "root", "", None])
def test_role_change_never_grants_admin(admin_client, user, db, role):
    response = admin_client.patch(f"/admin/users/{user.id}", json={"role": role})

    assert response.status_code == 422
    db.refresh(user)
    assert user.role == m.RoleEnum.USER


def test_role_change_cannot_demote_admin(admin_client, make_user, db):
    second_admin = make_user("admin")

    response = admin_client.patch(f"/admin/users/{second_admin.id}", json={"role": "user"})

    assert response.status_code == 400
    db.refresh(second_admin)
    assert second_admin.role == m.RoleEnum.ADMIN


def test_role_change_for_unknown_user(admin_client):
    response = admin_client.patch(f"/admin/users/{uuid.uuid4()}", json={"role": "specialist"})

    assert response.status_code == 404


def test_proposals_are_listed_with_author(admin_client, user, make_proposal):
    make_proposal(user)

    [row] = admin_client.get("/admin/project-proposals").json()

    assert row["author_email"] == user.email
    assert row["author_name"] == "Ula Zwykła"
    assert row["status"] == "nowe"


@pytest.mark.parametrize(
    ("action", "status"), [("accept", "zaakceptowane"), ("reject", "odrzucone")]
)
def test_proposal_decision(admin_client, user, make_proposal, action, status):
    proposal = make_proposal(user)

    response = admin_client.post(f"/admin/project-proposals/{proposal.id}/{action}")

    assert response.status_code == 200
    assert response.json()["status"] == status


@pytest.mark.parametrize("first", ["accept", "reject"])
@pytest.mark.parametrize("second", ["accept", "reject"])
def test_proposal_can_be_decided_only_once(admin_client, user, make_proposal, db, first, second):
    proposal = make_proposal(user)
    admin_client.post(f"/admin/project-proposals/{proposal.id}/{first}")
    db.refresh(proposal)
    decided = proposal.status

    response = admin_client.post(f"/admin/project-proposals/{proposal.id}/{second}")

    assert response.status_code == 400
    db.refresh(proposal)
    assert proposal.status == decided


@pytest.mark.parametrize("action", ["accept", "reject"])
def test_proposal_decision_for_unknown_id(admin_client, action):
    assert admin_client.post(f"/admin/project-proposals/{uuid.uuid4()}/{action}").status_code == 404
