# HubMI — Next.js (Pages) + FastAPI monorepo

Szkielet na HackYeah: frontend Next.js (Pages Router), backend FastAPI, panel administracyjny z JWT i bazą SQLite.

## Struktura

```
apps/
  web/   # Next.js Pages Router (panel admina)
  api/   # FastAPI + SQLAlchemy + SQLite
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

## Uruchomienie

```bash
npm run dev
```

- Web: http://localhost:3000  
- Admin login: http://localhost:3000/admin/login  
- Admin panel: http://localhost:3000/admin  
- API docs: http://localhost:8000/docs  

### Domyślne konto admina

| Pole | Wartość |
|------|---------|
| Email | `admin@hubmi.dev` |
| Hasło | `admin12345` |

Zmienisz w `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Przy starcie API konto jest seedowane automatycznie.

Jeśli zmieniasz schemat bazy lokalnie, usuń `apps/api/data/hubmi.db` i zrestartuj API.

## Auth / Admin API

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `POST` | `/auth/register` | Rejestracja użytkownika (`role=user`) |
| `POST` | `/auth/login` | Login → JWT |
| `GET`  | `/auth/me` | Profil (Bearer) |
| `GET`  | `/admin/stats` | Statystyki (tylko admin) |
| `GET`  | `/admin/users` | Lista użytkowników (tylko admin) |
