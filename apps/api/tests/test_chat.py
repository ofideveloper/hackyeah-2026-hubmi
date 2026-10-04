import json
import uuid
from datetime import datetime, timedelta

import pytest
from sqlmodel import select

from app import models as m
from app.dependencies.rate_limit import CLIENT_IP_HEADER
from app.routes import chat as chat_module
from app.routes.chat import CHAT_MESSAGE_MAX, CHAT_TURNS_MAX, NO_MATCH_REPLY, LLMError, judge_reply

MATCH = "[[hubmi-status:match]]"
CLARIFY = "[[hubmi-status:clarify]]"
NO_MATCH = "[[hubmi-status:no-match]]"
DRAFT_BLOCK = (
    "[[hubmi-new-project]]\nNAME: Wypożyczalnia wózków\n"
    "DESCRIPTION: Brakuje wypożyczalni wózków inwalidzkich w gminie.\n[[/hubmi-new-project]]"
)


def marker(project) -> str:
    return f"[[hubmi-project:{project.id}]]"


def ask(client, message="Szukam wsparcia dla seniorów", **extra):
    return client.post("/chat/", json={"message": message, **extra})


# --- werdykt: odpowiedź modelu kontra baza ----------------------------------


@pytest.fixture
def judge(db, catalog):
    """`judge(szablon)` — w szablonie `{p0}`..`{p2}` to znaczniki projektów z katalogu."""
    pairs = [(project, "Obszar") for project in catalog]

    def run(template: str):
        raw = template.format(
            p0=marker(catalog[0]),
            p1=marker(catalog[1]),
            p2=marker(catalog[2]),
            unknown=f"[[hubmi-project:{uuid.uuid4()}]]",
        )
        return judge_reply(raw, pairs)

    return run


@pytest.mark.parametrize(
    ("template", "status", "projects"),
    [
        pytest.param("Polecam.\n{p0}\n" + MATCH, "match", 1, id="match-z-projektem"),
        pytest.param("Polecam.\n{p0}{p1}{p2}\n" + MATCH, "match", 3, id="match-trzy-projekty"),
        pytest.param("Polecam.\n{p0}{p0}\n" + MATCH, "match", 1, id="powtorzony-znacznik"),
        pytest.param("Polecam.\n{unknown}\n" + MATCH, "no-match", 0, id="match-z-id-spoza-katalogu"),
        pytest.param("Polecam.\n{unknown}{p1}\n" + MATCH, "match", 1, id="zmyslone-id-pominiete"),
        pytest.param("Polecam coś.\n" + MATCH, "no-match", 0, id="match-bez-projektow"),
        pytest.param("Polecam **Teleopieka domowa**.\n" + MATCH, "match", 1, id="nazwa-bez-znacznika"),
        pytest.param("Polecam teleopieka DOMOWA.", "match", 1, id="nazwa-bez-statusu"),
        pytest.param("{p0}", "match", 1, id="projekt-bez-statusu"),
        pytest.param("Kogo dotyczy sprawa?\n" + CLARIFY, "clarify", 0, id="clarify"),
        pytest.param("Może to?\n{p0}\n" + CLARIFY, "clarify", 0, id="clarify-ukrywa-projekty"),
        pytest.param("Dzień dobry.", "clarify", 0, id="brak-znacznikow"),
        pytest.param("Nie mamy.\n" + NO_MATCH, "no-match", 0, id="no-match"),
        pytest.param("Nie mamy, ale {p0}\n" + NO_MATCH, "no-match", 0, id="no-match-ukrywa-projekty"),
        pytest.param("Polecam.\n{p0}\n[[HUBMI-STATUS:MATCH]]", "match", 1, id="znacznik-wielkimi-literami"),
    ],
)
def test_judge_reply_trusts_the_database_over_the_model(judge, template, status, projects):
    verdict = judge(template)

    assert verdict.status == status
    assert len(verdict.projects) == projects
    assert "[[" not in verdict.reply, "znaczniki sterujące nie trafiają do użytkownika"


def test_judge_reply_keeps_at_most_three_projects_in_model_order(db, make_project):
    projects = [make_project() for _ in range(5)]
    raw = "".join(marker(project) for project in reversed(projects)) + MATCH

    verdict = judge_reply(raw, [(project, "Obszar") for project in projects])

    assert [p.id for p in verdict.projects] == [p.id for p in reversed(projects)][:3]


@pytest.mark.parametrize(
    ("block", "draft"),
    [
        pytest.param(DRAFT_BLOCK, ("Wypożyczalnia wózków", "Brakuje wypożyczalni wózków inwalidzkich w gminie."), id="pelny"),
        pytest.param(
            "[[hubmi-new-project]]\nname: Świetlica\ndescription: Linia 1\nLinia 2\n[[/hubmi-new-project]]",
            ("Świetlica", "Linia 1\nLinia 2"),
            id="male-litery-i-opis-wieloliniowy",
        ),
        pytest.param("[[hubmi-new-project]]\nNAME: X\nDESCRIPTION: Opis\n[[/hubmi-new-project]]", None, id="nazwa-za-krotka"),
        pytest.param("[[hubmi-new-project]]\nNAME: Świetlica\n[[/hubmi-new-project]]", None, id="brak-opisu"),
        pytest.param("", None, id="brak-bloku"),
    ],
)
def test_judge_reply_extracts_new_project_draft(judge, block, draft):
    verdict = judge(f"Nie mamy tego.\n{block}\n{NO_MATCH}")

    assert (verdict.draft and (verdict.draft.name, verdict.draft.description)) == draft
    assert verdict.reply == "Nie mamy tego."


# --- endpoint ---------------------------------------------------------------


def test_clarify_reply(client, llm, catalog, db):
    llm.reply(f"Kogo dotyczy sprawa?\n{CLARIFY}")

    response = ask(client)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "clarify"
    assert body["reply"] == "Kogo dotyczy sprawa?"
    assert body["suggested_projects"] == []
    assert body["new_project_draft"] is None and body["similar"] is None
    assert db.exec(select(m.NeedSignal)).all() == [], "dopytanie nie jest jeszcze potrzebą"


def test_match_returns_project_cards_from_the_database(client, llm, catalog, db):
    llm.reply(f"**Teleopieka domowa** pasuje.\n{marker(catalog[0])}\n{MATCH}")

    body = ask(client).json()

    assert body["status"] == "match"
    assert body["suggested_projects"] == [
        {
            "id": str(catalog[0].id),
            "name": "Teleopieka domowa",
            "description": "Opaska z przyciskiem SOS.",
            "unit_name": "Dla seniorów",
        }
    ]
    [signal] = db.exec(select(m.NeedSignal)).all()
    assert signal.category_id == catalog[0].category_id


def test_system_prompt_carries_the_catalog(client, llm, catalog):
    ask(client, "Potrzebuję pomocy")

    system, question = llm.calls[0]
    assert system["role"] == "system"
    for project in catalog:
        assert f"### {project.name}\nID: {project.id}" in system["content"]
    assert question == {"role": "user", "content": "Potrzebuję pomocy"}


def test_conversation_continues_with_full_history(client, llm, catalog, db):
    llm.reply(f"Kogo dotyczy?\n{CLARIFY}", f"Polecam.\n{marker(catalog[1])}\n{MATCH}")

    first = ask(client, "Potrzebuję pomocy").json()
    second = ask(client, "Chodzi o samotnych seniorów", chat_id=first["chat_id"]).json()

    assert second["chat_id"] == first["chat_id"]
    assert second["status"] == "match"
    assert [(msg["role"], msg["content"]) for msg in llm.calls[1][1:]] == [
        ("user", "Potrzebuję pomocy"),
        ("assistant", f"Kogo dotyczy?\n{CLARIFY}"),
        ("user", "Chodzi o samotnych seniorów"),
    ]
    [history] = db.exec(select(m.ChatHistory)).all()
    assert history.first_question == "Potrzebuję pomocy"
    assert len(json.loads(history.all_conversation)) == 4


def test_separate_chats_do_not_share_history(client, llm, catalog):
    first = ask(client, "Pierwsza sprawa").json()
    second = ask(client, "Druga sprawa").json()

    assert first["chat_id"] != second["chat_id"]
    assert len(llm.calls[1]) == 2, "nowa rozmowa zaczyna od samego system promptu i pytania"


@pytest.mark.parametrize(
    ("model_reply", "draft"),
    [
        pytest.param(
            f"Nie mamy.\n{DRAFT_BLOCK}\n{NO_MATCH}",
            {"name": "Wypożyczalnia wózków", "description": "Brakuje wypożyczalni wózków inwalidzkich w gminie."},
            id="szkic-od-modelu",
        ),
        pytest.param(
            f"Nie mamy.\n{NO_MATCH}",
            {"name": "", "description": "Potrzebujemy wypożyczalni wózków"},
            id="szkic-z-wiadomosci-uzytkownika",
        ),
        pytest.param(
            f"Polecam Program Zmyślony.\n[[hubmi-project:{uuid.uuid4()}]]\n{MATCH}",
            {"name": "", "description": "Potrzebujemy wypożyczalni wózków"},
            id="zmyslony-projekt-traktowany-jak-brak",
        ),
    ],
)
def test_no_match_offers_new_project_draft(client, llm, catalog, db, scraper, model_reply, draft):
    llm.reply(model_reply)

    body = ask(client, "Potrzebujemy wypożyczalni wózków").json()

    assert body["status"] == "no-match"
    assert body["reply"] == NO_MATCH_REPLY, "przy braku dopasowania odpowiedź jest stała, nie od modelu"
    assert body["suggested_projects"] == []
    assert body["new_project_draft"] == draft
    assert scraper.calls == 1, "przed odpowiedzią „nie mamy” katalog jest dociągany ze źródła"
    [signal] = db.exec(select(m.NeedSignal)).all()
    assert signal.category_id is None


def test_no_match_asks_again_when_refresh_brought_new_projects(client, llm, catalog, scraper):
    scraper.added = 2
    llm.reply(f"Nie mamy.\n{NO_MATCH}", f"Jednak mamy.\n{marker(catalog[0])}\n{MATCH}")

    body = ask(client).json()

    assert body["status"] == "match"
    assert len(llm.calls) == 2


def test_catalog_refresh_has_cooldown(client, llm, catalog, scraper):
    llm.default = f"Nie mamy.\n{NO_MATCH}"

    for _ in range(3):
        assert ask(client).json()["status"] == "no-match"

    assert scraper.calls == 1


def test_need_is_recorded_once_per_area_within_a_chat(client, llm, catalog, db):
    llm.default = f"Polecam.\n{marker(catalog[0])}\n{MATCH}"

    chat_id = ask(client).json()["chat_id"]
    ask(client, "A coś jeszcze?", chat_id=chat_id)
    ask(client, "Osobna rozmowa")

    assert len(db.exec(select(m.NeedSignal)).all()) == 2


def need(**fields) -> m.NeedSignal:
    """Potrzeba z innej rozmowy — tak zapisuje je `record_need`, zawsze z `chat_id`."""
    return m.NeedSignal(chat_id=uuid.uuid4(), **fields)


def test_similar_cases_count_other_recent_needs_and_approved_ideas(
    client, llm, catalog, db, user, make_idea
):
    area = catalog[0].category_id
    db.add_all(
        [
            need(category_id=area),
            need(category_id=area),
            need(category_id=catalog[2].category_id),
            need(category_id=area, created_at=(datetime.now() - timedelta(days=45)).isoformat()),
        ]
    )
    db.commit()
    make_idea(user, "approved", category_id=area, name="Klub sąsiedzki")
    make_idea(user, "pending", category_id=area, name="Niezatwierdzony")
    llm.reply(f"Polecam.\n{marker(catalog[0])}\n{MATCH}")

    similar = ask(client).json()["similar"]

    assert similar["area_name"] == "Dla seniorów"
    assert similar["needs_last_30_days"] == 2
    assert [idea["name"] for idea in similar["related_ideas"]] == ["Klub sąsiedzki"]


def test_similar_unmet_needs_are_matched_by_keywords(client, llm, catalog, db):
    db.add_all(
        [
            need(summary="Wypożyczalnia wózków inwalidzkich dla gminy"),
            need(summary="Nocna świetlica dla młodzieży"),
        ]
    )
    db.commit()
    llm.reply(f"Nie mamy.\n{DRAFT_BLOCK}\n{NO_MATCH}")

    similar = ask(client).json()["similar"]

    assert similar["needs_last_30_days"] == 1
    assert similar["area_name"] is None


@pytest.mark.parametrize(
    ("payload", "status"),
    [
        pytest.param({"message": ""}, 422, id="pusta-wiadomosc"),
        pytest.param({}, 422, id="brak-wiadomosci"),
        pytest.param({"message": "x" * (CHAT_MESSAGE_MAX + 1)}, 422, id="za-dluga"),
        pytest.param({"message": "x" * CHAT_MESSAGE_MAX}, 200, id="na-granicy"),
        pytest.param({"message": "Hej", "chat_id": "abc"}, 422, id="zle-id-rozmowy"),
        pytest.param({"message": "Hej", "chat_id": str(uuid.uuid4())}, 404, id="nieznana-rozmowa"),
    ],
)
def test_request_validation(client, llm, payload, status):
    assert client.post("/chat/", json=payload).status_code == status


def test_too_long_conversation_must_be_restarted(client, llm, db):
    turns = [{"role": "user", "text": "x"}] * CHAT_TURNS_MAX
    history = m.ChatHistory(first_question="x", all_conversation=json.dumps(turns))
    db.add(history)
    db.commit()

    response = ask(client, chat_id=str(history.id))

    assert response.status_code == 409
    assert llm.calls == []


def test_failed_model_call_does_not_save_the_message(client, llm, catalog, db):
    llm.reply(LLMError("pusta odpowiedź modelu"))

    response = ask(client)

    assert response.status_code == 502
    assert "pusta odpowiedź modelu" in response.json()["detail"]
    assert db.exec(select(m.ChatHistory)).all() == []


# --- limity żądań -----------------------------------------------------------


@pytest.mark.parametrize(
    ("role", "setting"),
    [("anonymous", "chat_rate_guest"), ("user", "chat_rate_user")],
)
def test_chat_is_rate_limited(client, client_for, make_user, llm, settings, role, setting):
    settings(**{setting: 2})
    caller = client if role == "anonymous" else client_for(make_user())

    responses = [ask(caller) for _ in range(3)]

    assert [response.status_code for response in responses] == [200, 200, 429]
    assert 0 < int(responses[-1].headers["Retry-After"]) <= 600
    assert len(llm.calls) == 2, "odrzucone żądanie nie kosztuje wywołania modelu"


def test_guest_limit_is_counted_per_client_ip(client, llm, settings):
    settings(chat_rate_guest=1)
    from_ip = lambda ip: ask(client.__class__(client.app, headers={CLIENT_IP_HEADER: ip}))  # noqa: E731

    assert from_ip("203.0.113.1").status_code == 200
    assert from_ip("203.0.113.1, 10.0.0.1").status_code == 429, "liczy się pierwszy adres z listy"
    assert from_ip("203.0.113.2").status_code == 200


def test_logged_in_user_has_own_counter(client, user_client, other_client, llm, settings):
    settings(chat_rate_guest=1, chat_rate_user=1)

    assert [ask(c).status_code for c in (client, user_client, other_client)] == [200, 200, 200]
    assert [ask(c).status_code for c in (client, user_client, other_client)] == [429, 429, 429]


def test_limit_resets_in_the_next_window(client, llm, settings, monkeypatch):
    window = settings(chat_rate_guest=1).ai_rate_window_s
    now = 1_800_000_000
    monkeypatch.setattr("app.dependencies.rate_limit.time.time", lambda: now)
    assert [ask(client).status_code for _ in range(2)] == [200, 429]

    now += window

    assert ask(client).status_code == 200


# --- połączenie z modelem ---------------------------------------------------


@pytest.fixture
def no_sleep(monkeypatch):
    async def instant(_seconds):
        return None

    monkeypatch.setattr(chat_module.asyncio, "sleep", instant)


def test_missing_api_key_is_reported_as_unavailable(client, monkeypatch):
    monkeypatch.setattr(chat_module, "_llm_config", lambda: ("http://127.0.0.1:9", "", "model"))

    response = ask(client)

    assert response.status_code == 503
    assert "LLM_API_KEY" in response.json()["detail"]


@pytest.mark.parametrize(
    ("failures", "retries", "status", "attempts"),
    [
        pytest.param(0, 2, 200, 1, id="od-razu"),
        pytest.param(2, 2, 200, 3, id="udana-ostatnia-proba"),
        pytest.param(3, 2, 502, 3, id="wyczerpane-proby"),
        pytest.param(1, 0, 502, 1, id="bez-ponowien"),
    ],
)
def test_model_call_is_retried(client, monkeypatch, no_sleep, failures, retries, status, attempts):
    calls = []

    async def flaky(messages, **config):
        calls.append(config)
        if len(calls) <= failures:
            raise LLMError("brak połączenia")
        return f"Kogo dotyczy sprawa?\n{CLARIFY}"

    monkeypatch.setattr(chat_module, "_ask_llm_once", flaky)
    monkeypatch.setattr(chat_module, "LLM_RETRIES", retries)

    response = ask(client)

    assert response.status_code == status
    assert len(calls) == attempts


@pytest.mark.parametrize(
    ("provider", "base_url", "model", "expected"),
    [
        ("openai", "", "", ("https://api.openai.com/v1", "gpt-4o-mini")),
        ("openrouter", "", "", ("https://openrouter.ai/api/v1", None)),
        ("deepseek", "", "", ("https://api.deepseek.com", None)),
        ("nieznany", "", "", ("https://api.openai.com/v1", "gpt-4o-mini")),
        ("openai", "https://proxy.example/v1/", "moj-model", ("https://proxy.example/v1", "moj-model")),
    ],
)
def test_llm_config_resolves_provider_defaults(settings, monkeypatch, provider, base_url, model, expected):
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    settings(llm_provider=provider, llm_base_url=base_url, llm_model=model, llm_api_key=" klucz ")

    base, key, resolved_model = chat_module._llm_config()

    assert base == expected[0]
    assert key == "klucz"
    assert resolved_model == (expected[1] or resolved_model)
    assert resolved_model


def _model_answers(monkeypatch, status_code: int, payload):
    """Podstawia odpowiedź dostawcy na poziomie transportu HTTP i zwraca listę żądań."""
    import httpx

    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if isinstance(payload, Exception):
            raise payload
        if isinstance(payload, str):
            return httpx.Response(status_code, text=payload)
        return httpx.Response(status_code, json=payload)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        chat_module.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler)),
    )
    return requests


def _ask_once():
    import asyncio

    return asyncio.run(
        chat_module._ask_llm_once(
            [{"role": "user", "content": "Hej"}], base="http://llm.test/v1", key="klucz", model="m1"
        )
    )


def _completion(content):
    return {"choices": [{"message": {"content": content}}]}


def test_model_request_carries_key_model_and_low_temperature(monkeypatch):
    requests = _model_answers(monkeypatch, 200, _completion(f"Kogo dotyczy?\n{CLARIFY}"))

    assert _ask_once() == f"Kogo dotyczy?\n{CLARIFY}"

    [request] = requests
    assert str(request.url) == "http://llm.test/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer klucz"
    body = json.loads(request.content)
    assert (body["model"], body["temperature"]) == ("m1", 0.2)


@pytest.mark.parametrize(
    ("status_code", "payload", "message"),
    [
        pytest.param(500, {"error": {"message": "przeciążenie"}}, "przeciążenie", id="blad-http-z-opisem"),
        pytest.param(429, {}, "HTTP 429", id="blad-http-bez-opisu"),
        pytest.param(502, "<html>Bad Gateway</html>", "HTTP 502", id="blad-http-nie-json"),
        pytest.param(200, {"error": {"message": "limit dostawcy"}}, "limit dostawcy", id="blad-w-body-przy-200"),
        pytest.param(200, {"error": "tekstowy błąd"}, "tekstowy błąd", id="blad-jako-tekst"),
        pytest.param(200, {"choices": []}, "nieoczekiwany format", id="brak-choices"),
        pytest.param(200, {"wynik": "x"}, "nieoczekiwany format", id="inny-ksztalt"),
        pytest.param(200, _completion(""), "pusta odpowiedź", id="pusta-tresc"),
        pytest.param(200, _completion(None), "pusta odpowiedź", id="tresc-null"),
        pytest.param(200, _completion(f"  \n{CLARIFY}"), "pusta odpowiedź", id="sam-znacznik-statusu"),
    ],
)
def test_bad_model_response_becomes_llm_error(monkeypatch, status_code, payload, message):
    _model_answers(monkeypatch, status_code, payload)

    with pytest.raises(LLMError, match=message):
        _ask_once()


def test_network_failure_becomes_llm_error(monkeypatch):
    import httpx

    _model_answers(monkeypatch, 200, httpx.ConnectError("odmowa połączenia"))

    with pytest.raises(LLMError, match="brak połączenia z http://llm.test/v1"):
        _ask_once()
