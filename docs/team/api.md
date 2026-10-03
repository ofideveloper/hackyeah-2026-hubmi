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
| POST | `/chat/` | Body: `{ message }` → `{ reply }` (Gemini; bez `GEMINI_API_KEY` → 503) |
| POST | `/llm/chat` | **Legacy** — bypass LLM (`messages[]`, `model?`) → `{ id, model, provider, content }` |
| GET | `/llm/health` | **Legacy** — provider klienta (`fake` / `openai` / `gemini`) |
| GET | `/health` | Healthcheck (`{ status: "healthy" }`) |

Router `/users` jest zarejestrowany, ale nie ma jeszcze endpointów.

**LLM:** `/chat/` woła Gemini bezpośrednio (`app/routes/chat.py`, env `GEMINI_API_KEY`). Pakiet `app/llm/` (klient `fake|openai|gemini`, prompt opiekuna) i router `app/routes/llm.py` to **legacy** — działają (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`), ale nie rozwijamy ich.

Modele (`app/models.py`, id = UUID): `User`, `CategoriesOfProjects`, `ActualProject`, `ProposalOfNewProject`, `Benefice`, `ProjectBenefices`, `ChatHistory`.

## Auth i role

- JWT (Bearer, `sub` = email, `exp`), sekret: `SECRET_KEY`, ważność: `ACCESS_TOKEN_EXPIRE_MINUTES`; hasła: scrypt
- Role: `admin` | `user` | `specialist`
- Brak seeda admina; `/categories` i `/projects` wymagają zalogowania (dowolna rola)

[UZUPEŁNIJ — reguły haseł, expiry, refresh?]

## Dane

- `DATABASE_URL` (domyślnie SQLite `apps/api/data/hubmi.db`) — `app/dependencies/db.py`
- Vercel: SQLite trafia do `/tmp` (nietrwałe) — produkcja: ustaw `DATABASE_URL` (np. Postgres)
- Tabele tworzy `SQLModel.metadata.create_all` przy starcie; brak migracji

[UZUPEŁNIJ — model domenowy / migracje]

## Konwencje kodu

- Router per domena w `app/routes/`
- Modele tabel i schematy wejścia/wyjścia (SQLModel) razem w `app/models.py`
- Zależności FastAPI w `app/dependencies/` (`SessionDep`, `CurrentUserDep`)
- [UZUPEŁNIJ — walidacja, paginacja, format błędów]

## Checklist PR (api)

- [ ] Endpoint chroniony właściwą zależnością (`CurrentUserDep`)
- [ ] Brak sekretów w kodzie
- [ ] Zmiana schematu udokumentowana w `docs/team` lub README
