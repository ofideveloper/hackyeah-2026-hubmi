# Produkt i domena

## Nazwa i one-liner

- **Nazwa:** HubMI
- **One-liner:** PWA, w której mieszkaniec rozmawia ze społecznym opiekunem, a jednostki i projekty działają „pod spodem”.

## Opis (HackYeah)

Aplikacja webowa (PWA) z dwoma perspektywami:

1. **Admin** — jednostki (teren + kompetencje), projekty, statusy spraw mieszkańców.
2. **Mieszkaniec** — czat ze **społecznym opiekunem** + podgląd **statusów spraw** (bez formularzy, bez listy projektów).
3. **AI** — prowadzi rozmowę; może sugerować projekty / otwierać sprawy (under the hood). UI nie zmusza usera do tych akcji.

## Copy na UI

| Ekran | Element | Tekst |
|-------|---------|--------|
| Landing | Brand | HubMI |
| Landing | Headline | Zgłaszaj problemy i wydarzenia w swojej jednostce. |
| Landing | CTA | Zaloguj się → `/login`, Załóż konto → `/register` |
| Login | Tytuł | Zaloguj się |
| Login | Support | Wróć do zgłoszeń i pomysłów w swojej jednostce. |
| Register | Tytuł | Załóż konto |
| App `/app` | Czat | Witaj, {username} · Twój społeczny opiekun |
| App `/app` | Czat support | Opowiedz, co Cię zajmuje — razem pomyślimy nad rozwiązaniem. |
| App `/app` | Sprawy | Statusy aktualizuje zespół — Ty tylko śledzisz postęp. |
| Admin `/admin` | Intro | Jednostki, projekty, statusy spraw |

Nie używaj na landingu / loginie copy o „panelu administracyjnym” ani stacku (monorepo, API, JWT).

## Użytkownicy

| Persona | Cel | Notatki |
|---------|-----|---------|
| Mieszkaniec (`user`) | Rozmowa + podgląd statusów spraw | `/login` → `/app` (bez CRUD zgłoszeń/projektów) |
| Admin | Jednostki, projekty, zmiana statusów | `/admin` |
| AI / czat | Prowadzi rozmowę na bazie jednostek/projektów; może sugerować sprawy | `AssistantChat` → `/chat` → Gemini (`LLM_PROVIDER=gemini`) lub `fake` |

## Zakres HackYeah (in / out)

**In scope**

- PWA (web) — installable: manifest + ikony + service worker
- Auth / authz (`admin` / `user`)
- Jednostki + projekty (admin)
- Czat mieszkańca (bez export/save)
- Sprawy: status `nowe` / `w_toku` / `zakonczone` (admin zmienia; user czyta)
- API tworzenia spraw (pod AI/system), nie UI mieszkańca

**Out of scope (na teraz)**

- Publiczne wystawianie FastAPI na Vercel
- Export / import / zapis rozmowy
- Historia rozmowy / zapis czatu (tylko pojedyncze wiadomości + kontekst DB)
- Mapa GIS

## Słownik domenowy

| Termin | Znaczenie |
|--------|-----------|
| Społeczny opiekun | Persona czatu dla mieszkańca |
| Jednostka | Org unit z terenem i kompetencjami (admin) |
| Projekt | Inicjatywa jednostki — under the hood / sugerowana przez AI |
| Sprawa | Zapis potrzeby; status widoczny dla mieszkańca |
| BFF | Next.js `/api/*` proxy do internal FastAPI |

## Decyzje produktowe (log)

| Data | Decyzja | Dlaczego |
|------|---------|----------|
| 2026-10 | API internal na Vercel | Bezpieczeństwo |
| 2026-10 | Login = mieszkaniec, nie panel admina | Produkt dla mieszkańca |
| 2026-10 | User bez formularza zgłoszeń i listy projektów | Fajna platforma rozmowy; AI/admin under the hood |
| 2026-10 | Admin zmienia statusy spraw | User tylko je widzi |
| 2026-10 | Gemini jako provider czatu | Odpowiedzi z kontekstu jednostek/projektów z DB |
