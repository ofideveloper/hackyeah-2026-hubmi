# MaloHUB

**Twój społeczny opiekun lokalnych spraw.**

PWA na [HackYeah](https://hackyeah.pl): mieszkaniec rozmawia naturalnie z AI, a system dopasowuje projekty i jednostki — bez formularzy i bez zgadywania, „do kogo napisać”.

---

## Problem

Ludzie nie wiedzą, która jednostka odpowiada za ich sprawę. Formularze zniechęcają, a pomoc społeczna / lokalne inicjatywy giną w szumie.

## Rozwiązanie

**MaloHUB** zamienia zgłoszenie w rozmowę ze **społecznym opiekunem**:

1. Opisujesz sytuację własnymi słowami (nawet bez konta — na landingu).
2. AI dobiera pasujący **projekt** albo zbiera materiał pod **nową propozycję**.
3. Admin i jednostka widzą propozycje / sprawy i prowadzą status dalej.

```
Mieszkaniec  →  czat opiekuna  →  sugestia projektu / intake
                     ↓
              Admin + jednostka  →  projekt / sprawa / status
```

---

## Demo na scenę (2–3 min)

| Krok | Co pokazać | Gdzie |
|------|------------|--------|
| 1 | Landing + czat gościa | `/` — napisz np. *„moja mama ma autyzm”* |
| 2 | Karta projektu (np. Himalaje) | sugestia w czacie → podgląd |
| 3 | Konto mieszkańca + sprawy | `/register` → `/app` |
| 4 | Panel admina | `/admin` — jednostki, projekty, propozycje, statusy |

**Konto demo (admin)**

| | |
|---|---|
| Email | `admin@malohub.dev` |
| Hasło | `admin12345` |

---

## Co działa (MVP HackYeah)

- **Czat opiekuna** — Markdown, historia w sesji, „Nowa sprawa”
- **Matching projektów** — scoring + markery kart w UI
- **Lokalizacja** — prośba o obszar / GPS, gdy sprawa jest terenowa
- **Propozycje projektów** — z czatu do kolejki admina
- **Sprawy** — statusy `nowe` → `w_toku` → `zakonczone`
- **PWA** — installable (manifest + ikony + service worker)
- **Gość na landingu** — rozmowa bez logowania; zapis dalej po koncie

---

## Stack (krótko)

| Warstwa | Tech |
|---------|------|
| Web | Next.js (Pages Router) + React · BFF `/api/*` |
| API | FastAPI + SQLAlchemy + SQLite |
| AI | OpenAI / Gemini / fake · prompt w `caretaker_system.md` |
| Deploy | Vercel Services — web publiczny, API internal |

Przeglądarka **nigdy** nie woła FastAPI bezpośrednio — tylko Next BFF → `API_URL`.

---

## Uruchomienie lokalne

**Wymagania:** Node 20+, Python 3.11+

```bash
npm install
npm run setup:api

cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
# w .env ustaw LLM_PROVIDER + LLM_API_KEY (albo fake)

npm run dev
```

| Adres | Rola |
|-------|------|
| http://localhost:3000 | Aplikacja (landing, czat, `/app`, `/admin`) |
| http://localhost:8000/docs | FastAPI (tylko lokalnie) |

Szczegóły zespołu / AI: [`AGENTS.md`](AGENTS.md) · [`docs/team/`](docs/team/).

---

## Persony

| Kto | Co robi |
|-----|---------|
| **Mieszkaniec** | Rozmawia z opiekunem, śledzi status spraw |
| **Admin** | Jednostki, projekty, propozycje z czatu, statusy |
| **Opiekun (AI)** | Dopasowuje projekt albo zbiera draft dla jednostki |

---

## HackYeah — one-liner

> MaloHUB: jeden czat zamiast labiryntu urzędów — społeczny opiekun łączy mieszkańca z właściwym projektem i jednostką.
