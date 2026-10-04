import uuid

import pytest

from app.routes.middleman import INSTITUTION_LABEL

from .conftest import assert_admin_only, call

PATH = "/admin/middleman/adapt"


def payload(innovation, **changes):
    return {
        "innovation_id": str(innovation.id),
        "institution_kind": "ops",
        "audience": "Samotni seniorzy w gminie wiejskiej",
        **changes,
    }


def test_access(as_role):
    role, client = as_role
    assert_admin_only(role, call(client, "POST", PATH).status_code)


def test_service_card_is_built_from_catalog_entry(admin_client, catalog, llm):
    llm.reply("\n### Usługa w jednym zdaniu\n- Teleopieka dla seniorów.\n\n")

    response = admin_client.post(PATH, json=payload(catalog[0], budget="20 tys. zł"))

    assert response.status_code == 200
    body = response.json()
    assert body["innovation_name"] == "Teleopieka domowa"
    assert body["service_card"] == "### Usługa w jednym zdaniu\n- Teleopieka dla seniorów."
    prompt = llm.calls[0][1]["content"]
    assert "Nazwa: Teleopieka domowa" in prompt
    assert "Obszar: Dla seniorów" in prompt
    assert "Opaska z przyciskiem SOS." in prompt
    assert "Budżet: 20 tys. zł" in prompt
    assert "Ograniczenia: (nie podano)" in prompt


@pytest.mark.parametrize("kind", sorted(INSTITUTION_LABEL))
def test_every_institution_kind_is_described_in_prompt(admin_client, catalog, llm, kind):
    response = admin_client.post(PATH, json=payload(catalog[0], institution_kind=kind))

    assert response.status_code == 200
    assert f"Rodzaj: {INSTITUTION_LABEL[kind]}" in llm.calls[0][1]["content"]


def test_unknown_innovation(admin_client, catalog, llm):
    response = admin_client.post(PATH, json=payload(catalog[0], innovation_id=str(uuid.uuid4())))

    assert response.status_code == 404
    assert llm.calls == []


@pytest.mark.parametrize(
    "changes",
    [
        pytest.param({"institution_kind": "szkola"}, id="nieznany-rodzaj"),
        pytest.param({"audience": "ab"}, id="odbiorcy-za-krotko"),
        pytest.param({"audience": "   "}, id="odbiorcy-same-spacje"),
        pytest.param({"audience": "x" * 1501}, id="odbiorcy-za-dlugo"),
        pytest.param({"institution_name": "x" * 301}, id="nazwa-za-dluga"),
        pytest.param({"resources": "x" * 1501}, id="zasoby-za-dlugie"),
        pytest.param({"innovation_id": "to-nie-uuid"}, id="zle-id"),
        pytest.param({"nieznane": "pole"}, id="nadmiarowe-pole"),
    ],
)
def test_rejects_invalid_payload(admin_client, catalog, llm, changes):
    response = admin_client.post(PATH, json=payload(catalog[0], **changes))

    assert response.status_code == 422
    assert llm.calls == []


def test_calls_are_rate_limited_per_admin(admin_client, catalog, llm, settings):
    settings(ai_rate_user=2)
    statuses = [admin_client.post(PATH, json=payload(catalog[0])).status_code for _ in range(3)]

    assert statuses == [200, 200, 429]
