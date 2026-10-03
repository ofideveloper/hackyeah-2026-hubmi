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
| GET | `/ideas` | Publiczna lista fiszek Kreatora pomysłów (bez canvy; autor jako „Imię N.”; bez `status=rejected`) |
| GET | `/ideas/mine` | Fiszki zalogowanego — z canvą |
| POST / PATCH / DELETE | `/ideas`, `/ideas/{id}` | Fiszka (`name`, `description`, `essence`, `audience`, `stage`, `category_id`, `canvas{}`) — edycja tylko autor; usuwa autor lub admin |
| GET | `/admin/ideas` | Wszystkie fiszki (admin): pełny autor, e-mail, canva, także odrzucone |
| PATCH | `/admin/ideas/{id}` | Zmiana statusu fiszki (admin): `{ status: pending\|approved\|rejected }`; `rejected` ukrywa ją publicznie |
| POST | `/ideas/assistant` | Asystent kreatora (zalogowany): `{ action: develop\|unconventional\|canvas\|visualize\|ask, idea, question? }` → `{ reply, svg? }` |
| GET | `/grant-calls` | Publicznie tylko **trwające** nabory (z pytaniami wniosku) |
| GET / PUT | `/grant-calls/{id}/application` | Wniosek zalogowanego w naborze: szkic lub `submit: true`; po złożeniu / po terminie → 409 |
| GET / POST / PATCH / DELETE | `/admin/grant-calls[/{id}]` | Nabory (admin): terminy + lista pytań; DELETE → 409, gdy są złożone wnioski |
| GET | `/admin/grant-calls/{id}/applications` | Złożone wnioski naboru (admin; szkice są prywatne) |
| GET | `/testing/solutions` | Publiczna lista rozwiązań do oceny i testów: innowacje (`ActualProject`) + zatwierdzone fiszki; ze średnią oceną, liczbą opinii i testerów |
| GET | `/testing/solutions/{kind}/{id}/reviews` | Publiczne opinie o rozwiązaniu (`kind`: `innowacja` \| `pomysl`; autor jako „Imię N.”) |
| GET | `/testing/mine` | Zgłoszenia do testów i opinie zalogowanego |
| POST | `/testing/solutions/{kind}/{id}/signups` | Zgłoszenie chęci udziału w testach `{ motivation? }` — można zgłosić się wielokrotnie |
| DELETE | `/testing/signups/{id}` | Wycofanie własnego zgłoszenia |
| PUT / DELETE | `/testing/solutions/{kind}/{id}/review` | Opinia zalogowanego `{ rating 1–5, feedback?, improvement? }` — jedna na osobę i rozwiązanie (upsert); PUT tylko dla testera (przyjęte zgłoszenie do tego rozwiązania), inaczej 403 |
| GET / PATCH | `/admin/testing/signups[/{id}]` | Zgłoszenia testerów (admin): pełne dane testera; `{ status: pending\|approved\|rejected }` |
| GET / DELETE | `/admin/testing/reviews[/{id}]` | Opinie (admin): pełny autor; usunięcie = moderacja |
| GET | `/mentors` | Publiczna lista mentorów (rola `specialist`): „Imię N.”, organizacja, sektor, opis — bez e-maila i telefonu |
| GET | `/partnerships` | Publiczna tablica ogłoszeń partnerskich (JWT opcjonalny → `is_mine`); autor jako „Imię N.” + organizacja + sektor |
| POST | `/partnerships` | Ogłoszenie `{ kind: szukam\|oferuje, title, description, sought_sector? }` — zalogowany z ustawionym sektorem, inaczej 400 |
| DELETE | `/partnerships/{id}` | Usuwa autor lub admin (moderacja); rozmowy zostają, tracą tylko powiązanie z ogłoszeniem |
| POST | `/partnerships/{id}/contact` | Odpowiedź `{ body }` → rozmowa z autorem ogłoszenia; kolejna odpowiedź tej samej osoby trafia do tej samej rozmowy; własne ogłoszenie → 400 |
| GET | `/conversations` | Rozmowy zalogowanego (jako autor lub odbiorca) z flagą `unread`; admin dostaje też wszystkie pytania do ROPS z e-mailem pytającego |
| POST | `/conversations` | Nowa rozmowa `{ kind: pytanie\|mentoring, subject, body, mentor_id? }` — `mentoring` wymaga `mentor_id` użytkownika z rolą `specialist` |
| GET | `/conversations/{id}` | Rozmowa z wiadomościami (ostatnie 200); oznacza jako przeczytaną. Klient odpytuje ten endpoint co 5 s. Nie-uczestnik → 404 |
| PATCH | `/conversations/{id}` | `{ status: otwarta\|zamknieta }` — każdy uczestnik |
| POST | `/conversations/{id}/messages` | Wiadomość `{ body }` (do 2000 znaków); zamknięta rozmowa → 409; ponad 20 wiadomości na minutę → 429 |
| PATCH | `/users/me` | Profil zalogowanego `{ sector?, organization, mentor_bio }` → `UserPublic` |
| PATCH | `/admin/users/{id}` | Nadanie / odebranie roli mentora (admin): `{ role: user\|specialist }`; konto admina → 400 |
| POST | `/llm/chat` | **Legacy** — bypass LLM (`messages[]`, `model?`) → `{ id, model, provider, content }` |
| GET | `/llm/health` | **Legacy** — provider klienta (`fake` / `openai` / `gemini`) |
| GET | `/health` | Healthcheck (`{ status: "healthy" }`) |

**LLM:** `/chat/` woła Gemini bezpośrednio (`app/routes/chat.py`, env `GEMINI_API_KEY`). Pakiet `app/llm/` (klient `fake|openai|gemini`, prompt opiekuna) i router `app/routes/llm.py` to **legacy** — działają (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`), ale nie rozwijamy ich.

Modele (`app/models.py`, id = UUID): `User`, `CategoriesOfProjects`, `ActualProject`, `ProposalOfNewProject`, `Benefice`, `ProjectBenefices`, `ChatHistory`, `GrantCall`, `GrantApplication`, `TesterSignup`, `SolutionReview`, `Conversation`, `Message`, `PartnershipListing`.

**Kreator pomysłów** (`app/routes/ideas.py`): fiszka to wiersz `ProposalOfNewProject` (`name` = tytuł, `description` = krótki opis) z dopisanymi kolumnami `essence`, `audience`, `stage`, `canvas` (dokładane przy starcie w `_add_missing_columns`); schematy wejścia/wyjścia są lokalne w routerze. Asystent używa `ask_llm` z `routes/chat.py` (te same `LLM_*`). Wizualizacja to SVG z modelu tekstowego — API przepuszcza tylko pojedynczy `<svg>` bez skryptów / linków / obrazów, FE renderuje go wyłącznie w `<img>` (data URI). Pola canvy: `IDEA_CANVAS_KEYS` w `models.py` (etykiety w `apps/web/src/lib/ideas.ts`).

**Tester innowacji** (`app/routes/testing.py`): cel zgłoszenia / opinii to para `target_kind` + `target_id` (innowacja z biblioteki albo fiszka o statusie `approved`) — bez klucza obcego, więc usunięcie fiszki sprząta jej zgłoszenia i opinie w `delete_idea`. Niezatwierdzona fiszka → 404.

**Platforma komunikacji** (`app/routes/communication.py`): pytania do ROPS, rozmowy z mentorami i odpowiedzi na ogłoszenia partnerskie to jeden model — `Conversation` (`kind`: `pytanie` \| `mentoring` \| `partnerstwo`) + `Message`. Pytanie do ROPS ma `recipient_id = NULL`: odbiorcą jest każdy admin, a `recipient_read_at` to wspólny znacznik odczytu zespołu. „Nieprzeczytane” liczone jest z `last_author_id` + `last_message_at` względem znacznika odczytu danej strony; GET rozmowy zapisuje znacznik tylko wtedy, gdy jest co oznaczyć. Bez WebSocket / SSE — proxy BFF buforuje odpowiedzi, więc klient odpytuje. Profil (`sector`, `organization`, `mentor_bio`) to kolumny `User` dokładane w `_add_missing_columns`; są w `UserPublic`, ale nie w `UserBase`, żeby rejestracja ich nie przyjmowała. Kto co widzi: [`security.md`](./security.md).

## Auth i role

- JWT (Bearer, `sub` = email, `exp`), sekret: `SECRET_KEY`, ważność: `ACCESS_TOKEN_EXPIRE_MINUTES`; hasła: scrypt
- Role: `admin` | `user` | `specialist` (`specialist` = mentor; nadaje ją admin przez `PATCH /admin/users/{id}`)
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
