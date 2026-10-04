import pytest

from .conftest import assert_login_required, call

ROUTES = [("POST", "/llm/chat"), ("GET", "/llm/health")]


@pytest.mark.parametrize(("method", "path"), ROUTES)
def test_access(as_role, method, path):
    role, client = as_role
    assert_login_required(role, call(client, method, path).status_code)


def test_health_reports_configured_provider(user_client):
    assert user_client.get("/llm/health").json() == {"status": "ok", "provider": "fake"}


@pytest.mark.parametrize("model", [None, "moj-model"])
def test_chat_answers_without_external_model(user_client, model):
    payload = {"messages": [{"role": "user", "content": "Dzień dobry"}]}
    if model:
        payload["model"] = model

    response = user_client.post("/llm/chat", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "fake"
    assert body["model"] == (model or "hubmi-fake-v1")
    assert body["content"].strip()


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"messages": []}, id="brak-wiadomosci"),
        pytest.param({"messages": [{"role": "robot", "content": "x"}]}, id="nieznana-rola"),
        pytest.param({"messages": [{"role": "user", "content": ""}]}, id="pusta-tresc"),
        pytest.param({"messages": [{"role": "user", "content": "x" * 16001}]}, id="za-dluga-tresc"),
        pytest.param(
            {"messages": [{"role": "user", "content": "x"}], "model": "m" * 129}, id="za-dlugi-model"
        ),
        pytest.param({}, id="puste"),
    ],
)
def test_chat_rejects_invalid_payload(user_client, payload):
    assert user_client.post("/llm/chat", json=payload).status_code == 422
