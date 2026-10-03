# HubMI — Next.js (Pages) + FastAPI monorepo

Szkielet na HackYeah: frontend Next.js (Pages Router), backend FastAPI, panel administracyjny z JWT i bazą SQLite.

## Struktura

```
apps/
  web/   # Next.js Pages Router (panel admina + BFF /api/*)
  api/   # FastAPI + SQLAlchemy + SQLite (internal on Vercel)
```

## Wymagania

- Node.js 20+
- Python 3.11+

## Setup

```bash
npm install
npm run setup:api

cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

## Uruchomienie lokalne

```bash
npm run dev
```

- Web: http://localhost:3000  
- Admin login: http://localhost:3000/admin/login  
- Admin panel: http://localhost:3000/admin  
- Public API (przez Next BFF): http://localhost:3000/api/...  
- FastAPI bezpośrednio (dev): http://localhost:8000/docs  

Przeglądarka woła tylko `/api/*` na Next.js. Next proxy’uje do FastAPI (`API_URL`, domyślnie `http://localhost:8000`).

### Domyślne konto admina

| Pole | Wartość |
|------|---------|
| Email | `admin@hubmi.dev` |
| Hasło | `admin12345` |

Zmienisz w `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Przy starcie API konto jest seedowane automatycznie.

Jeśli zmieniasz schemat bazy lokalnie, usuń `apps/api/data/hubmi.db` i zrestartuj API.

## Deploy na Vercel (Services)

Projekt używa [Vercel Services](https://vercel.com/docs/services): `web` (publiczny) + `api` (internal).

1. Utwórz projekt i ustaw **Framework** na **Services**.
2. Podłącz repozytorium (root = katalog z `vercel.json`).
3. Ustaw env dla API: `SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (opcjonalnie `DATABASE_URL` → Postgres).
4. **Nie ustawiaj** `API_URL` ręcznie — Vercel wstrzyknie je z bindingu `web → api`.

Lokalnie pełny stack jak na Vercel: `vercel dev` (lub `vercel dev -L`).

### Routing

| Ścieżka publiczna | Serwis | Uwagi |
|-------------------|--------|--------|
| `/*` | `web` | Next.js UI + BFF `/api/*` |
| — | `api` | brak rewrite; tylko przez binding `API_URL` |

## Auth / Admin API

Publicznie (przez BFF):

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `POST` | `/api/auth/register` | Rejestracja użytkownika (`role=user`) |
| `POST` | `/api/auth/login` | Login → JWT |
| `GET`  | `/api/auth/me` | Profil (Bearer) |
| `GET`  | `/api/admin/stats` | Statystyki (tylko admin) |
| `GET`  | `/api/admin/users` | Lista użytkowników (tylko admin) |

Wewnętrznie FastAPI nadal eksponuje `/auth/*` i `/admin/*` (bez prefiksu `/api`).
