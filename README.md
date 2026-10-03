# MaloHUB

Online: [https://hackyeah-2026-hubmi.vercel.app/](https://hackyeah-2026-hubmi.vercel.app/)

PWA na HackYeah — mieszkaniec rozmawia ze społecznym opiekunem AI, a system dopasowuje projekty, zbiera zgłoszenia i kieruje sprawy do właściwych jednostek.

## Problem

Ludzie nie wiedzą, która jednostka odpowiada za ich sprawę. Formularze zniechęcają, a lokalne inicjatywy giną w szumie urzędów i kontaktów.

## Rozwiązanie

MaloHUB zamienia zgłoszenie w rozmowę ze **społecznym opiekunem**:

1. Opisujesz sytuację własnymi słowami (nawet bez konta — na landingu).
2. AI dobiera gotowe rozwiązanie z katalogu **albo** zapisuje zgłoszenie / zbiera materiał pod nową inicjatywę.
3. Admin i jednostka widzą sprawy i propozycje oraz prowadzą status dalej.

```
Mieszkaniec  →  czat opiekuna  →  katalog / zgłoszenie / intake
                     ↓
              Admin + jednostka  →  projekt / sprawa / status
```

## Logowanie (demo)

| | |
|---|---|
| Email | `admin@malohub.dev` |
| Hasło | `admin12345` |

## Stack

| Warstwa | Tech |
|---------|------|
| Web | Next.js (Pages Router) + React · BFF `/api/*` |
| API | FastAPI + SQLModel + SQLite |
| AI | OpenAI / Gemini / fake · prompt opiekuna |
| Deploy | Vercel — web publiczny, API internal |

Przeglądarka woła tylko `/api/*` (Next BFF) → `API_URL` → FastAPI.

## Uruchomienie lokalne

**Wymagania:** Node 20+, Python 3.11+

```bash
npm install
npm run setup:api

cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

W `.env` (wzór: [`.env.example`](.env.example)) ustaw m.in.:

- `LLM_API_KEY` + `LLM_MODEL` (+ opcjonalnie `LLM_BASE_URL`) na serwisie **api** — bez tego czat na produkcji zwraca błąd auth modelu
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (domyślnie jak w tabeli powyżej)
- `API_URL=http://localhost:8000` (także w `apps/web/.env.local`)

```bash
npm run dev
```

| Adres | Rola |
|-------|------|
| http://localhost:3000 | Aplikacja |
| http://localhost:8000/docs | FastAPI (tylko lokalnie) |
