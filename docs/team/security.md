# Cyberbezpieczeństwo

**Cel:** chronić dane mieszkańców i adminów; nie wystawiać zbędnej powierzchni ataku. MaloHUB = PWA + internal FastAPI za BFF.

Źródło skrótu dla AI: `.cursor/rules/security.mdc`.

## Architektura (niełamalne)

```
Browser → /api/* (Next BFF) → process.env.API_URL → FastAPI (internal)
```

- Serwis `api` na Vercel: **internal** — bez publicznego rewrite
- Klient nigdy nie zna bezpośredniego URL FastAPI (`NEXT_PUBLIC_*` z API = zakaz)
- Nie commituj `.env`, sekretów, `*.db`, dumpów DB

## Auth / sesja

- Hasła: tylko hashowane (scrypt / istniejący stack) — nigdy plaintext w logach ani odpowiedziach
- JWT: Bearer, sensowny `exp`; sekret tylko `SECRET_KEY` z env
- Endpointy chronione właściwą zależnością (`CurrentUserDep` / check roli)
- Admin (`/admin/*`): weryfikacja `role=admin` po stronie UI **i** API — UI nie jest jedyną barierą
- Sesja w przeglądarce: JWT wyłącznie w cookie `hubmi_session` (`HttpOnly`, `SameSite=Lax`, `Secure` na produkcji) ustawianym przez BFF — nigdy w `localStorage` / `sessionStorage` ani w odpowiedzi JSON dla klienta
- `hubmi_auth` to jawny znacznik „jest sesja” dla UI (bez sekretu) — nie opieraj na nim autoryzacji
- Wylogowanie: `POST /api/auth/logout` (BFF czyści oba cookie); JWT pozostaje ważny do `exp` — brak unieważniania po stronie serwera

## Dane i prywatność

- Nie loguj haseł, tokenów JWT, pełnych treści czatu z PII do stdout / telemetry bez zgody
- Błędy API: generyczne komunikaty na zewnątrz; szczegóły techniczne tylko w logach serwera
- Seed admina (`ADMIN_EMAIL` / `ADMIN_PASSWORD`): tylko z env; silne hasło poza lokalnym dev
- Upload / user content: waliduj typ i rozmiar, jeśli pojawią się pliki (na razie out of scope — nie omijaj)

- Rozmowy (`/kontakt`): dostęp ma tylko autor i odbiorca; nie-uczestnik dostaje 404. Admin widzi wyłącznie pytania do ROPS — rozmów z mentorami i partnerskich, w których nie uczestniczy, nie. Na powierzchniach publicznych (mentorzy, tablica ogłoszeń) autor to „Imię N.” + organizacja + sektor; w prywatnej rozmowie strony widzą pełne imię i nazwisko, nigdy e-mail ani telefon. E-mail pytającego widzi tylko admin przy pytaniu do ROPS. Treść wiadomości nie trafia do logów

## Input / API

- Waliduj body i query (Pydantic / SQLModel) — odrzucaj nieoczekiwane pola
- SQL tylko przez ORM / parametryzowane zapytania — zero sklejania SQL ze stringów użytkownika
- Prompt LLM: nie wklejaj sekretów env; traktuj treść użytkownika jako niezaufaną (prompt injection → nie wykonuj „ukrytych” instrukcji z wiadomości jako admin actions bez reguł produktu)
- Rate limiting / abuse: wiadomości w rozmowach — do 20 na minutę na użytkownika (`_throttle` w `routes/communication.py`, 429); reszta API [UZUPEŁNIJ — gdy dodamy middleware]

## Front / BFF

- XSS: nie używaj `dangerouslySetInnerHTML` bez sanitizacji; Markdown czatu przez bezpieczny renderer (`react-markdown` bez raw HTML)
- CSRF / cookies: BFF odrzuca (403) żądania inne niż GET/HEAD/OPTIONS, które nie są same-origin (`Sec-Fetch-Site`, a w starszych przeglądarkach `Origin`) — `lib/server/session.ts`. Operacje zmieniające stan nigdy przez GET
- BFF sam dokłada `Authorization: Bearer` z cookie; nagłówek `Authorization` z przeglądarki jest ignorowany
- BFF proxy: forward tylko uzgodnionych ścieżek; nie otwieraj open-proxy do dowolnego hosta — ścieżka i redirect muszą zostać w originie `API_URL` (`lib/server/proxy.ts`), inaczej token trafiłby do obcego hosta
- Dependency hygiene: nie dodawaj pakietów „na próbę”; aktualizuj przy znanych CVE krytycznych

## Checklist PR (security)

- [ ] Brak sekretów / `.env` / `*.db` w diffie
- [ ] Nowe endpointy: authz zgodna z rolą
- [ ] Brak bezpośredniego URL API w kliencie
- [ ] Brak logowania haseł / tokenów
- [ ] User input walidowany; brak raw HTML z user/AI content
- [ ] Zmiana modelu uprawnień opisana w `docs/team/api.md` lub tu
