# Produkt i domena

## Nazwa i one-liner

- **Nazwa:** HubMI
- **One-liner:** PWA łącząca mieszkańców ze zgłoszeniami potrzeb a jednostki organizacyjne z ich terenem i kompetencjami — z AI po środku (kolejny krok).

## Opis (HackYeah)

Aplikacja webowa (PWA) z dwoma perspektywami:

1. **Admin** — tworzy **jednostki organizacyjne** (teren + kompetencje) oraz ich **projekty** (nazwa + opis).
2. **Mieszkaniec (user)** — tworzy **zgłoszenia** do jednostek; przegląda projekty.
3. **Asystent na `/app`** — uproszczony czat (UI z aivoxpop, bez export/save); dopasowuje potrzeby do projektów. Pełny komponent AI można podmienić później.

Obecny MVP: jednostki + projekty + zgłoszenia + czat (bez zapisu rozmowy).

## Copy na UI

| Ekran | Element | Tekst |
|-------|---------|--------|
| Landing | Brand | HubMI |
| Landing | Headline | Zgłaszaj problemy i wydarzenia w swojej jednostce. |
| Landing | CTA | Zaloguj się → `/login`, Załóż konto → `/register` |
| Login | Tytuł | Zaloguj się |
| Login | Support | Wróć do zgłoszeń i pomysłów w swojej jednostce. |
| Register | Tytuł | Załóż konto |
| App `/app` | Intro | Wybierz jednostkę wg terenu i kompetencji, potem zgłoś potrzebę. |
| Admin `/admin` | Intro | Jednostki, kompetencje i zakres terytorialny |

Nie używaj na landingu / loginie copy o „panelu administracyjnym” ani stacku (monorepo, API, JWT).

## Użytkownicy

| Persona | Cel | Notatki |
|---------|-----|---------|
| Mieszkaniec (`user`) | Tworzy zgłoszenia do jednostek wg odpowiedzialności | `/login` → `/app` |
| Admin | Tworzy jednostki i projekty | `/admin` (link z `/app` jeśli role=admin) |
| AI / czat | Dopasowanie do projektów na `/app` | UI: `AssistantChat`; bez export/save; logika matching do podmiany |

## Zakres HackYeah (in / out)

**In scope**

- PWA (web)
- Auth / authz (`admin` / `user`)
- Jednostki: nazwa, teren, kompetencje (CRUD admin)
- Projekty jednostki: nazwa + opis (CRUD admin; lista dla usera)
- Zgłoszenia mieszkańca: wybór jednostki + rodzaj + opis
- Auth JWT + seed admina
- Panel admina (stats, jednostki, projekty, użytkownicy)

**Out of scope (na teraz)**

- Publiczne wystawianie FastAPI na Vercel
- Export / import / zapis rozmowy w czacie
- Pełny LLM — obecnie matching słów kluczowych; gotowy komponent AI do podmiany
- Mapa GIS / precyzyjne granice terytorium

## Słownik domenowy

| Termin | Znaczenie |
|--------|-----------|
| Jednostka | Org unit z terenem i kompetencjami |
| Teren odpowiedzialności | Obszar, za który odpowiada jednostka (tekst) |
| Kompetencje | Zakres spraw, które jednostka obsługuje |
| Zgłoszenie | Problem, wydarzenie lub informacja skierowana do jednostki |
| Projekt | Inicjatywa jednostki (nazwa + opis) pod przyszłe dopasowanie osób |
| BFF | Next.js `/api/*` proxy do internal FastAPI |
| Binding `API_URL` | Wewnętrzny URL serwisu `api` na Vercel |

## Decyzje produktowe (log)

| Data | Decyzja | Dlaczego |
|------|---------|----------|
| 2026-10 | API internal na Vercel | Bezpieczeństwo — brak publicznego backendu |
| 2026-10 | Landing = copy produktowe, nie techniczne | Aplikacja hackathonowa prezentowana użytkownikowi końcowemu |
| 2026-10 | Login = mieszkaniec (`/login` → `/app`), nie panel admina | HubMI łączy mieszkańca z jednostkami; admin osobno |
| 2026-10 | MVP: jednostki + zgłoszenia bez AI | Najpierw flow odpowiedzialności; AI w kolejnym kroku |
| 2026-10 | Projekty bez czatu | Dane projektów najpierw; czat AI jako osobny komponent |
