# API — reguły zespołu

Stack: FastAPI + SQLModel w `apps/api/app` (`main.py`, `models.py`, `routes/`, `dependencies/`).

## Publiczne vs internal

| Środowisko | Jak dojść do API |
|------------|------------------|
| Lokalnie | Next BFF `/api/*` **lub** bezpośrednio `:8000` (docs) |
| Vercel | **Tylko** binding `API_URL` z serwisu `web` — brak publicznego rewrite |

Ścieżki FastAPI (bez prefiksu `/api`):

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/auth/register` | Rejestracja (`role=user`); duplikat emaila → 409 |
| POST | `/auth/login` | Form `username` + `password` → `{ access_token, token_type }`; błąd → 400 |
| GET | `/auth/me` | Profil (`UserPublic`) |
| GET | `/categories` | Lista kategorii projektów (zalogowany — cały router `/categories`) |
| GET | `/categories/{id}` | Kategoria |
| POST | `/categories` | Utwórz kategorię (nazwa unikalna → 409) |
| PATCH | `/categories/{id}` | Zmień nazwę |
| DELETE | `/categories/{id}` | Usuń (409, gdy używana przez projekt / propozycję) |
| POST | `/projects/` | Utwórz projekt (`category_id`, `name`, `description`) — zalogowany |
| POST | `/chat` | Body: `{ message, history?, chat_id? }` → `{ reply, chat_id, suggested_projects[], report_offer, created_report?, project_proposal?, location_request? }` (JWT opcjonalny) |
| PATCH | `/admin/units/{id}` | Edycja jednostki (`name` / `territory` / `competencies`) |
| PATCH | `/admin/projects/{id}` | Edycja projektu jednostki (`unit_id` / `name` / `description`) |
| POST | `/llm/chat` | **Legacy** — bypass LLM (`messages[]`, `model?`) → `{ id, model, provider, content }` |
| GET | `/llm/health` | **Legacy** — provider klienta (`fake` / `openai` / `gemini`) |
| GET | `/health` | Healthcheck (`{ status: "healthy" }`) |

Router `/users` jest zarejestrowany, ale nie ma jeszcze endpointów.

**LLM:** `/chat/` woła Gemini bezpośrednio (`app/routes/chat.py`, env `GEMINI_API_KEY`). Pakiet `app/llm/` (klient `fake|openai|gemini`, prompt opiekuna) i router `app/routes/llm.py` to **legacy** — działają (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`), ale nie rozwijamy ich.

Modele (`app/models.py`, id = UUID): `User`, `CategoriesOfProjects`, `ActualProject`, `ProposalOfNewProject`, `Benefice`, `ProjectBenefices`, `ChatHistory`.

## Auth i role

- JWT (Bearer, `sub` = email, `exp`), sekret: `SECRET_KEY`, ważność: `ACCESS_TOKEN_EXPIRE_MINUTES`; hasła: scrypt
- Role: `admin` | `user` | `specialist`
- Przy starcie `seed_admin_user` (`app/seed.py`) tworzy admina z `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_FULL_NAME` (domyślnie `admin@malohub.dev`); istniejący user z tym emailem dostaje `role=admin`
- `/categories` i `/projects` wymagają zalogowania (dowolna rola)

[UZUPEŁNIJ — reguły haseł, expiry, refresh?]

## Dane

- `DATABASE_URL` (domyślnie SQLite `apps/api/data/hubmi.db`) — `app/dependencies/db.py`
- Vercel: SQLite trafia do `/tmp` (nietrwałe) — produkcja: ustaw `DATABASE_URL` (np. Postgres)
- Startup: `create_all` + przebudowa legacy tabel `reports` / `project_proposals` (INTEGER → UUID), jeśli wykryte
- Sprawy z czatu: tryb `report` + marker `[[hubmi-new-report]]` **albo** CTA „Zapisz zgłoszenie” (synteza z historii) — wymaga JWT

[UZUPEŁNIJ — pełne migracje / Postgres]

## Konwencje kodu

- Router per domena w `app/routes/`
- Modele tabel i schematy wejścia/wyjścia (SQLModel) razem w `app/models.py`
- Zależności FastAPI w `app/dependencies/` (`SessionDep`, `CurrentUserDep`)
- Logi: `logger = get_logger(__name__)` z `app/dependencies/logger.py` zamiast `print`; poziom przez `LOG_LEVEL` (domyślnie `INFO`). Loguj id, nie emaile / hasła / tokeny / treść czatu
- [UZUPEŁNIJ — walidacja, paginacja, format błędów]

## Bezpieczeństwo

Reguły cybersec (authz, input, sekrety, BFF): [`security.md`](./security.md); egzekucja AI: `.cursor/rules/security.mdc`.

## Checklist PR (api)

- [ ] Endpoint chroniony właściwą zależnością (`CurrentUserDep`)
- [ ] Brak sekretów w kodzie
- [ ] Zmiana schematu udokumentowana w `docs/team` lub README
- [ ] Authz / walidacja inputu zgodna z `security.md`
