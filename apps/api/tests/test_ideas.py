import uuid

import pytest
from sqlmodel import select

from app import models as m

from .conftest import ANY_ID, assert_admin_only, assert_login_required, call

USER_ROUTES = [
    ("GET", "/ideas/mine"),
    ("POST", "/ideas"),
    ("PATCH", f"/ideas/{ANY_ID}"),
    ("DELETE", f"/ideas/{ANY_ID}"),
    ("POST", "/ideas/assistant"),
]
ADMIN_ROUTES = [("GET", "/admin/ideas"), ("PATCH", f"/admin/ideas/{ANY_ID}")]


@pytest.mark.parametrize(("method", "path"), USER_ROUTES)
def test_user_access(as_role, method, path):
    role, client = as_role
    assert_login_required(role, call(client, method, path).status_code)


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_access(as_role, method, path):
    role, client = as_role
    assert_admin_only(role, call(client, method, path).status_code)


def idea_payload(category, **changes):
    return {
        "name": "Sąsiedzka wypożyczalnia",
        "description": "Wspólny sprzęt rehabilitacyjny.",
        "category_id": str(category.id),
        **changes,
    }


# --- lista publiczna --------------------------------------------------------


@pytest.mark.parametrize(
    ("status", "visible"), [("pending", True), ("approved", True), ("rejected", False)]
)
def test_public_list_hides_rejected_ideas(client, user, make_idea, status, visible):
    make_idea(user, status, name="Klub sąsiedzki")

    names = [row["name"] for row in client.get("/ideas").json()]

    assert names == (["Klub sąsiedzki"] if visible else [])


def test_public_list_exposes_no_private_data(client, user, make_idea):
    make_idea(user, canvas='{"problem": "notatka robocza"}', admin_note="uwaga zespołu")

    [row] = client.get("/ideas").json()

    assert row["author_name"] == "Ula Z."
    assert "canvas" not in row and "admin_note" not in row
    assert user.email not in str(row) and user.surname not in str(row)


# --- fiszka autora ----------------------------------------------------------


def test_create_stores_idea_as_pending_for_the_author(user_client, user, category):
    response = user_client.post(
        "/ideas",
        json=idea_payload(
            category,
            name="  Sąsiedzka wypożyczalnia  ",
            stage="prototyp",
            canvas={"problem": "  Brak sprzętu  ", "ryzyka": "   "},
        ),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Sąsiedzka wypożyczalnia"
    assert body["status"] == "pending"
    assert body["stage"] == "prototyp"
    assert body["category_name"] == category.name
    # puste pola canvy nie są zapisywane, reszta jest przycinana
    assert body["canvas"] == {"problem": "Brak sprzętu"}
    assert [row["id"] for row in user_client.get("/ideas/mine").json()] == [body["id"]]


@pytest.mark.parametrize(
    "extra",
    [
        pytest.param({"status": "approved"}, id="wlasny-status"),
        pytest.param({"author_id": "00000000-0000-4000-8000-000000000001"}, id="cudzy-autor"),
        pytest.param({"admin_note": "Zatwierdzam sam sobie"}, id="notatka-admina"),
    ],
)
def test_create_ignores_fields_owned_by_the_server(user_client, db, user, category, extra):
    body = user_client.post("/ideas", json=idea_payload(category, **extra)).json()

    stored = db.get(m.ProposalOfNewProject, uuid.UUID(body["id"]))
    assert stored.status == m.StatusEnum.PENDING
    assert stored.author_id == user.id
    assert stored.admin_note == ""


@pytest.mark.parametrize(
    "change",
    [
        pytest.param({"name": "N"}, id="tytul-1-znak"),
        pytest.param({"name": "x" * 161}, id="tytul-161-znakow"),
        pytest.param({"description": "O"}, id="opis-1-znak"),
        pytest.param({"description": "x" * 1001}, id="opis-1001-znakow"),
        pytest.param({"essence": "x" * 2001}, id="istota-za-dluga"),
        pytest.param({"audience": "x" * 1001}, id="odbiorcy-za-dlugo"),
        pytest.param({"stage": "wdrozone"}, id="nieznany-etap"),
        pytest.param({"category_id": "to-nie-uuid"}, id="zle-id-obszaru"),
        pytest.param({"canvas": {"nieznane": "x"}}, id="nieznane-pole-canvy"),
        pytest.param(
            {"canvas": {"problem": "x" * (m.IDEA_CANVAS_FIELD_MAX + 1)}}, id="pole-canvy-za-dlugie"
        ),
    ],
)
def test_create_rejects_invalid_payload(user_client, category, change):
    assert user_client.post("/ideas", json=idea_payload(category, **change)).status_code == 422


@pytest.mark.parametrize("stage", [stage.value for stage in m.IdeaStage])
def test_create_accepts_every_stage(user_client, category, stage):
    response = user_client.post("/ideas", json=idea_payload(category, stage=stage))

    assert response.status_code == 201
    assert response.json()["stage"] == stage


@pytest.mark.parametrize("key", m.IDEA_CANVAS_KEYS)
def test_create_accepts_every_canvas_field(user_client, category, key):
    response = user_client.post("/ideas", json=idea_payload(category, canvas={key: "Notatka"}))

    assert response.json()["canvas"] == {key: "Notatka"}


@pytest.mark.parametrize("method", ["POST", "PATCH"])
def test_idea_needs_existing_area(user_client, user, category, make_idea, method):
    path = "/ideas" if method == "POST" else f"/ideas/{make_idea(user).id}"

    response = user_client.request(
        method, path, json={**idea_payload(category), "category_id": str(uuid.uuid4())}
    )

    assert response.status_code == 404


def test_update_changes_own_idea_and_keeps_moderation_fields(
    user_client, db, user, category, make_idea
):
    idea = make_idea(user, "approved", admin_note="Dobre")

    response = user_client.patch(f"/ideas/{idea.id}", json=idea_payload(category, name="Po zmianie"))

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Po zmianie"
    assert body["status"] == "approved"
    assert body["admin_note"] == "Dobre"
    assert body["modified_at"] > idea.modified_at


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
@pytest.mark.parametrize("target", ["cudza", "nieistniejaca"])
def test_other_users_idea_is_reported_as_missing(
    other_client, db, user, category, make_idea, method, target
):
    idea = make_idea(user, name="Cudza fiszka")
    idea_id = idea.id if target == "cudza" else uuid.uuid4()

    response = other_client.request(method, f"/ideas/{idea_id}", json=idea_payload(category))

    assert response.status_code == 404
    db.refresh(idea)
    assert idea.name == "Cudza fiszka"


@pytest.mark.parametrize(
    ("method", "status"), [pytest.param("DELETE", 204, id="moderacja"), ("PATCH", 404)]
)
def test_admin_may_delete_but_not_edit_someone_elses_idea(
    admin_client, user, category, make_idea, method, status
):
    idea = make_idea(user)

    response = admin_client.request(method, f"/ideas/{idea.id}", json=idea_payload(category))

    assert response.status_code == status


def test_delete_removes_dependent_testing_data_and_unlinks_applications(
    user_client, db, user, other_user, make_idea, make_signup, make_review, make_grant_call
):
    idea = make_idea(user, "approved")
    kept = make_idea(user, "approved")
    make_signup(other_user, idea, "approved")
    make_review(other_user, idea)
    make_signup(other_user, kept)
    application = m.GrantApplication(
        call_id=make_grant_call().id, author_id=user.id, idea_id=idea.id
    )
    db.add(application)
    db.commit()

    assert user_client.delete(f"/ideas/{idea.id}").status_code == 204

    assert [s.target_id for s in db.exec(select(m.TesterSignup)).all()] == [kept.id]
    assert db.exec(select(m.SolutionReview)).all() == []
    db.refresh(application)
    assert application.idea_id is None


# --- moderacja --------------------------------------------------------------


def test_admin_list_includes_rejected_ideas_and_author_contact(admin_client, user, make_idea):
    make_idea(user, "rejected", canvas='{"problem": "x"}')

    [row] = admin_client.get("/admin/ideas").json()

    assert row["status"] == "rejected"
    assert row["author_email"] == user.email
    assert row["author_full_name"] == "Ula Zwykła"
    assert row["canvas"] == {"problem": "x"}


@pytest.mark.parametrize(
    ("status", "note", "phrases"),
    [
        ("approved", "", ["została zatwierdzona"]),
        ("rejected", "Za mało konkretów", ["nie została przyjęta", "Komentarz zespołu: Za mało konkretów"]),
        ("pending", "Uzupełnij budżet", ["Komentarz zespołu: Uzupełnij budżet"]),
    ],
)
def test_decision_notifies_author_in_a_thread(
    admin_client, user_client, db, user, make_idea, status, note, phrases
):
    idea = make_idea(user, name="Klub sąsiedzki")

    response = admin_client.patch(f"/admin/ideas/{idea.id}", json={"status": status, "note": note})

    assert response.status_code == 200
    assert response.json()["status"] == status
    assert response.json()["admin_note"] == note
    [thread] = user_client.get("/conversations").json()
    assert thread["subject"] == "Fiszka: Klub sąsiedzki"
    assert thread["counterpart_name"] == "Zespół ROPS"
    assert thread["unread"] is True
    [message] = user_client.get(f"/conversations/{thread['id']}").json()["messages"]
    assert "Klub sąsiedzki" in message["body"]
    for phrase in phrases:
        assert phrase in message["body"]


def test_following_decisions_append_to_the_same_thread(admin_client, db, user, make_idea):
    idea = make_idea(user)

    for status in ("approved", "rejected", "approved"):
        admin_client.patch(f"/admin/ideas/{idea.id}", json={"status": status})

    assert len(db.exec(select(m.Conversation)).all()) == 1
    assert len(db.exec(select(m.Message)).all()) == 3


@pytest.mark.parametrize(
    ("author_role", "payload", "messages"),
    [
        pytest.param("user", {"status": "pending"}, 0, id="bez-zmiany"),
        pytest.param("user", {"status": "pending", "note": "  "}, 0, id="pusta-notatka"),
        pytest.param("user", {"status": "pending", "note": "Uwaga"}, 1, id="sama-notatka"),
        pytest.param("admin", {"status": "approved"}, 0, id="wlasna-fiszka-admina"),
    ],
)
def test_notification_is_sent_only_when_something_changed_for_another_author(
    admin_client, admin, user, db, make_idea, author_role, payload, messages
):
    idea = make_idea(admin if author_role == "admin" else user)

    assert admin_client.patch(f"/admin/ideas/{idea.id}", json=payload).status_code == 200

    assert len(db.exec(select(m.Message)).all()) == messages


@pytest.mark.parametrize(
    ("payload", "status"),
    [
        pytest.param({"status": "zatwierdzona"}, 422, id="nieznany-status"),
        pytest.param({}, 422, id="brak-statusu"),
        pytest.param({"status": "approved", "note": "x" * 1001}, 422, id="notatka-za-dluga"),
    ],
)
def test_decision_rejects_invalid_payload(admin_client, user, make_idea, payload, status):
    idea = make_idea(user)

    assert admin_client.patch(f"/admin/ideas/{idea.id}", json=payload).status_code == status


def test_decision_for_unknown_idea(admin_client):
    response = admin_client.patch(f"/admin/ideas/{uuid.uuid4()}", json={"status": "approved"})

    assert response.status_code == 404


# --- asystent kreatora ------------------------------------------------------

DRAFT = {"name": "Mobilny punkt porad", "description": "Porady w małych miejscowościach."}

DEVELOP_REPLY = """### Tytuł
Mobilny punkt porad prawnych
### Opis
Bus z doradcą dojeżdża do wsi.
### Istota
**Dostęp** do porad bez dojazdu do miasta.
### Odbiorcy
Mieszkańcy małych miejscowości."""

CANVAS_REPLY = """### Problem
- Brak dostępu do porad
### 2. Odbiorcy
- Seniorzy
**Rozwiązanie**
- Bus z doradcą
### Miary efektu
- Liczba porad"""

SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="10" height="10"/></svg>'


def ask(client, action, **changes):
    return client.post("/ideas/assistant", json={"action": action, "idea": DRAFT, **changes})


def test_assistant_develop_splits_reply_into_form_fields(user_client, llm):
    llm.reply(DEVELOP_REPLY)

    body = ask(user_client, "develop").json()

    assert body["draft"] == {
        "name": "Mobilny punkt porad prawnych",
        "description": "Bus z doradcą dojeżdża do wsi.",
        "essence": "Dostęp do porad bez dojazdu do miasta.",
        "audience": "Mieszkańcy małych miejscowości.",
    }
    assert body["canvas"] is None and body["svg"] is None


def test_assistant_canvas_maps_headings_to_canvas_keys(user_client, llm):
    llm.reply(CANVAS_REPLY)

    body = ask(user_client, "canvas").json()

    assert body["canvas"] == {
        "problem": "- Brak dostępu do porad",
        "odbiorcy": "- Seniorzy",
        "rozwiazanie": "- Bus z doradcą",
        "efekty": "- Liczba porad",
    }


def test_assistant_visualize_returns_only_the_svg_element(user_client, llm):
    llm.reply(f"Oto szkic:\n```svg\n{SVG}\n```\nGotowe.")

    assert ask(user_client, "visualize").json()["svg"] == SVG


@pytest.mark.parametrize("action", ["unconventional", "ask"])
def test_assistant_free_text_actions_return_the_reply(user_client, llm, action):
    llm.reply("  **Wariant 1**: sąsiedzki dyżur.  ")

    body = ask(user_client, action, question="Jak dotrzeć do seniorów?").json()

    assert body == {
        "reply": "**Wariant 1**: sąsiedzki dyżur.",
        "svg": None,
        "canvas": None,
        "draft": None,
    }


@pytest.mark.parametrize(
    ("action", "question", "expected"),
    [
        ("ask", "Jak dotrzeć do seniorów?", "Pytanie: Jak dotrzeć do seniorów?"),
        ("develop", "Skup się na wsi", "Dodatkowa wskazówka autora: Skup się na wsi"),
        ("canvas", "", "Canvy innowacji społecznej"),
    ],
)
def test_assistant_prompt_contains_idea_and_task(user_client, llm, action, question, expected):
    llm.reply(DEVELOP_REPLY if action == "develop" else CANVAS_REPLY)

    ask(
        user_client,
        action,
        question=question,
        idea={**DRAFT, "stage": "prototyp", "canvas": {"problem": "Brak porad"}},
    )

    prompt = llm.calls[0][1]["content"]
    assert "Tytuł: Mobilny punkt porad" in prompt
    assert "Etap realizacji: prototyp" in prompt
    assert "Canva — problem: Brak porad" in prompt
    assert expected in prompt


@pytest.mark.parametrize(
    ("action", "reply"),
    [
        pytest.param("develop", "Nie wiem, co napisać.", id="develop-bez-sekcji"),
        pytest.param("canvas", "Nie wiem, co napisać.", id="canvas-bez-sekcji"),
        pytest.param("canvas", "### Problem\n\n### Odbiorcy\n", id="canvas-puste-sekcje"),
        pytest.param("visualize", "Nie umiem rysować.", id="brak-svg"),
        pytest.param("visualize", SVG.replace("<rect", "<script>alert(1)</script><rect"), id="svg-script"),
        pytest.param("visualize", SVG.replace("<rect", '<rect onload="x()"'), id="svg-onload"),
        pytest.param("visualize", SVG.replace("<rect", '<a href="https://x"/><rect'), id="svg-href"),
        pytest.param("visualize", SVG.replace("<rect", "<foreignObject/><rect"), id="svg-foreign-object"),
        pytest.param("visualize", SVG.replace("<rect", '<image src="x"/><rect'), id="svg-image"),
        pytest.param("visualize", SVG.replace("</svg>", "x" * 20001 + "</svg>"), id="svg-za-duze"),
    ],
)
def test_assistant_refuses_unusable_or_unsafe_model_output(user_client, llm, action, reply):
    llm.reply(reply)

    assert ask(user_client, action).status_code == 502


@pytest.mark.parametrize(
    ("changes", "detail"),
    [
        pytest.param({"idea": {}}, "Opisz najpierw pomysł", id="pusty-pomysl"),
        pytest.param({"idea": {"audience": "Seniorzy"}}, "Opisz najpierw pomysł", id="sami-odbiorcy"),
        pytest.param({"action": "ask", "question": "   "}, "Wpisz pytanie.", id="ask-bez-pytania"),
    ],
)
def test_assistant_needs_something_to_work_with(user_client, llm, changes, detail):
    response = user_client.post(
        "/ideas/assistant", json={"action": "develop", "idea": DRAFT, **changes}
    )

    assert response.status_code == 422
    assert detail in response.json()["detail"]
    assert llm.calls == []


@pytest.mark.parametrize(
    "changes",
    [
        pytest.param({"action": "translate"}, id="nieznana-akcja"),
        pytest.param({"question": "x" * 1001}, id="pytanie-za-dlugie"),
        pytest.param({"idea": {"name": "x" * 161}}, id="tytul-za-dlugi"),
    ],
)
def test_assistant_rejects_invalid_payload(user_client, llm, changes):
    response = user_client.post(
        "/ideas/assistant", json={"action": "ask", "idea": DRAFT, "question": "?", **changes}
    )

    assert response.status_code == 422


def test_assistant_calls_are_rate_limited_per_user(user_client, other_client, llm, settings):
    settings(ai_rate_user=2)

    statuses = [ask(user_client, "ask", question="?").status_code for _ in range(3)]

    assert statuses == [200, 200, 429]
    # limit jest liczony na osobę, nie globalnie
    assert ask(other_client, "ask", question="?").status_code == 200
