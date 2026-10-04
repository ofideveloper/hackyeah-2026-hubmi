# MaloHUB

Cyfrowe serce Małopolskiego Hubu Innowacji Społecznych — platforma, która łączy zgłaszane potrzeby z gotowymi innowacjami, zbiera nowe pomysły i prowadzi dialog między mieszkańcami, samorządami, organizacjami i ROPS Kraków.

Demo: [https://hackyeah-2026-hubmi.vercel.app/](https://hackyeah-2026-hubmi.vercel.app/)

## Problem

ROPS Kraków ma blisko 200 sprawdzonych innowacji społecznych, a w regionie działa wiele oddolnych inicjatyw. Brakuje miejsca, w którym ktoś z realnym problemem trafi na rozwiązanie, które już istnieje, a ktoś z pomysłem dostanie pomoc w jego rozwinięciu.

## Jak to działa

1. Mieszkaniec, NGO albo urzędnik opisuje potrzebę własnymi słowami — bez formularza, także bez konta.
2. Opiekun AI wskazuje pasujące innowacje z Biblioteki ROPS i pokazuje, ile podobnych potrzeb zgłoszono oraz jakie pomysły już nad nimi pracują.
3. Gdy nic nie pasuje, potrzeba trafia do zespołu ROPS jako propozycja, a w panelu admina buduje trend.
4. Dalej prowadzą moduły: Kreator pomysłów, Tester innowacji i bezpośrednia rozmowa z ROPS lub mentorem. Instytucji, która chce wdrożyć innowację, zespół ROPS przygotowuje kartę usługi w Middlemanie.

## Moduły wyzwania

| # | Moduł | Gdzie | Co robi |
|---|-------|-------|---------|
| I | Matchmaking społeczny | `/` i `/app` | Czat dopasowuje potrzebę do innowacji z katalogu; odpowiedź modelu jest weryfikowana z bazą, więc nie poleci rozwiązania, którego nie ma. Pokazuje podobne przypadki. |
| II | Zasobnik wiedzy | `/wiedza` | Wyzwania społeczne Małopolski, Biblioteka Innowacji z filmami, materiały edukacyjne; wyszukiwanie i filtry obszarów. Trendy potrzeb widzi tylko admin. |
| III | Kreator pomysłów | `/kreator` | Fiszka pomysłu, Canva innowacji społecznej, asystent AI (rozwinięcie, nietuzinkowe warianty, wypełnienie canvy, wizualizacja), wniosek w otwartym naborze grantowym. |
| IV | Tester innowacji | `/tester` | Zgłoszenie do testów, ocena rozwiązań, informacja zwrotna i propozycje usprawnień. |
| V | Platforma komunikacji | `/kontakt` | Pytania do zespołu ROPS, rozmowy z mentorami, tablica ogłoszeń partnerskich między sektorami. |
| VI | Panel administratora | `/admin` | Liczniki rzeczy czekających na decyzję, redakcja wiedzy, fiszki z komentarzem dla autora, nabory, testerzy, wiadomości, trendy. |
| VII | Middleman Innowacji | `/admin/middleman` | Narzędzie zespołu ROPS: asystent AI przekłada wybraną innowację na kartę usługi dla instytucji, która się zgłosiła — co zostaje, co zmienić, kroki, zasoby, szacunkowy koszt, ryzyka. |

## Komunikacja: od pomysłu do odpowiedzi

- Nowa fiszka, pytanie czy zgłoszenie testera pojawia się jako licznik w nawigacji panelu admina (odświeżany co 30 s) i na jego stronie startowej.
- Admin zatwierdza albo odrzuca fiszkę i może dopisać komentarz.
- Autor dostaje decyzję jako wiadomość od Zespołu ROPS w Kontakt → Rozmowy (z licznikiem nieprzeczytanych w menu) i widzi komentarz przy swojej fiszce. Może od razu odpisać.

## Jak używamy AI

- Model językowy dostaje katalog innowacji z bazy i odpowiada jednym z trzech werdyktów: dopasowanie, doprecyzowanie, brak w bazie. Każde wskazane rozwiązanie jest sprawdzane po identyfikatorze w bazie.
- „Podobne przypadki” liczone są bez modelu, po słowach kluczowych; użytkownik widzi tylko liczby i zatwierdzone pomysły, nigdy cudze opisy.
- Asystent kreatora i Middleman pracują wyłącznie na danych podanych przez użytkownika i opisie innowacji z Biblioteki.
- Dostawca modelu jest wymienny (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`) — dowolne API zgodne z OpenAI.

## Konto demo

| | |
|---|---|
| Email | `admin@malohub.dev` |
| Hasło | `admin12345` |

Konto służy tylko do pokazu. Przed wdrożeniem ustaw własne `ADMIN_PASSWORD` i `SECRET_KEY`.

## Architektura

| Warstwa | Technologia |
|---------|-------------|
| Web | Next.js (Pages Router) + React, PWA |
| BFF | Next.js `/api/*` — jedyny adres, z którym rozmawia przeglądarka |
| API | FastAPI + SQLModel; baza przez `DATABASE_URL` (SQLite lokalnie) |
| AI | API zgodne z OpenAI |
| Hosting | Vercel — web publiczny, API dostępne tylko wewnętrznie |

```
Przeglądarka → Next.js BFF (/api/*) → FastAPI → baza
                                         ↓
                                    dostawca LLM
```

## Bezpieczeństwo

- API nie jest wystawione publicznie; sesja to JWT w cookie HttpOnly ustawianym przez BFF, z kontrolą pochodzenia żądań.
- Role: użytkownik, mentor, admin. Katalog innowacji i zasoby wiedzy zmienia tylko admin.
- Wywołania AI mają limity: gość liczony po adresie IP, zalogowany po koncie; wiadomości i rozmowy mają limit długości.
- Hasła: scrypt z solą. Szczegóły: [`docs/team/security.md`](docs/team/security.md).

## Dostępność

Projektujemy pod WCAG 2.1 AA: skip link, widoczny fokus, natywne dialogi, etykiety pól, komunikaty w regionach live, `prefers-reduced-motion`. Wynik ostatniego audytu axe i lista testów ręcznych: [`docs/team/accessibility.md`](docs/team/accessibility.md).

## Koszt utrzymania i zasoby

Do uzupełnienia przed zgłoszeniem: hosting, baza danych, koszt wywołań modelu na rozmowę oraz czas pracy administratora.

## Uruchomienie lokalne

Wymagania: Node 20+, Python 3.11+

```bash
npm install
npm run setup:api

cp .env.example .env
echo "API_URL=http://localhost:8000" > apps/web/.env.local
```

W `.env` (wzór: [`.env.example`](.env.example)) ustaw:

- `LLM_API_KEY` i `LLM_MODEL` (opcjonalnie `LLM_BASE_URL`) — bez klucza czat i asystenci zwracają błąd
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `API_URL=http://localhost:8000` (także w `apps/web/.env.local`)

```bash
npm run dev
```

| Adres | Rola |
|-------|------|
| http://localhost:3000 | Aplikacja |
| http://localhost:8000/docs | Dokumentacja API (tylko lokalnie) |

Na Vercel ustaw `DATABASE_URL` na trwałą bazę — domyślny SQLite trafia tam do `/tmp` i dane znikają.

Reguły pracy zespołu i agentów AI: [`AGENTS.md`](AGENTS.md), [`docs/team/`](docs/team/).
