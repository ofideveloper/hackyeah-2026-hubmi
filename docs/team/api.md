# API — reguły zespołu

Stack: FastAPI w `apps/api` (`app/main.py`, `app/routers/`, `app/models.py`, …).

## Publiczne vs internal

| Środowisko | Jak dojść do API |
|------------|------------------|
| Lokalnie | Next BFF `/api/*` **lub** bezpośrednio `:8000` (docs) |
| Vercel | **Tylko** binding `API_URL` z serwisu `web` — brak publicznego rewrite |

Ścieżki FastAPI (bez prefiksu `/api`):

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/auth/register` | Rejestracja (`role=user`) |
| POST | `/auth/login` | JWT |
| GET | `/auth/me` | Profil |
| GET | `/admin/stats` | Admin (users + units + projects + reports) |
| GET | `/admin/users` | Admin |
| POST | `/admin/units` | Admin — utwórz jednostkę |
| DELETE | `/admin/units/{id}` | Admin — usuń jednostkę (+ zgłoszenia + projekty) |
| POST | `/admin/projects` | Admin — utwórz projekt i przydziel do jednostki |
| PATCH | `/admin/projects/{id}` | Admin — zmiana jednostki / nazwy / opisu |
| DELETE | `/admin/projects/{id}` | Admin — usuń projekt |
| GET | `/units` | Lista jednostek (zalogowany) |
| GET | `/projects` | Lista projektów (`?unit_id=` opcjonalnie) |
| GET | `/reports` | Moje zgłoszenia |
| POST | `/reports` | Nowe zgłoszenie (`unit_id`, `kind`, `title`, `description`) |
| POST | `/chat` | Asystent UI → buduje kontekst projektów → woła bypass LLM |
| POST | `/llm/chat` | Bypass LLM (`messages[]`, `model?`) → `{ id, model, provider, content }` |
| GET | `/llm/health` | Provider aktualnego klienta (`fake` / `http`) |
| GET | `/health` | Healthcheck |

**LLM bypass:** `app/llm/client.py` — domyślnie `LLM_PROVIDER=fake`. `/chat` nie woła modelu bezpośrednio; zawsze przez ten klient. Potem podmiana na prawdziwy HTTP bez zmiany frontu.

Modele: `OrganizationalUnit`, `Project`, `Report`, kontrakt `LLMChatRequest/Response`.

## Auth i role

- JWT (Bearer), sekret: `SECRET_KEY`
- Role: `admin` | `user`
- Seed admina z env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`

[UZUPEŁNIJ — reguły haseł, expiry, refresh?]

## Dane

- Dev: SQLite `apps/api/data/hubmi.db`
- Vercel: SQLite trafia do `/tmp` (nietrwałe) — produkcja: ustaw `DATABASE_URL` (np. Postgres)
- `create_all` nie zmienia istniejących kolumn — drobne poprawki SQLite w `app/migrate.py` (np. `projects.title` → `name`)

[UZUPEŁNIJ — model domenowy / migracje]

## Konwencje kodu

- Router per domena w `app/routers/`
- Schematy Pydantic w `schemas.py`, modele SQLAlchemy w `models.py`
- [UZUPEŁNIJ — walidacja, paginacja, format błędów]

## Checklist PR (api)

- [ ] Endpoint chroniony właściwą zależnością (`get_current_user` / `get_current_admin`)
- [ ] Brak sekretów w kodzie
- [ ] Zmiana schematu udokumentowana w `docs/team` lub README
