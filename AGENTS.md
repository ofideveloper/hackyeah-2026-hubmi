# MaloHUB — reguły dla agentów AI i zespołu

Ten plik jest wejściem dla AI (Cursor) i ludzi. Szczegóły żyją w `.cursor/rules/` oraz w `docs/team/`.

## Szybki kontekst

**Produkt:** PWA — użytkownicy w jednostkach zgłaszają problemy / wydarzenia / informacje (predefiniowane zadania + własny opis). Dwa modele: (1) dopasowanie usera do kategorii treści, (2) matching podobnych spraw z boostem priority. Szczegóły: `docs/team/product.md`.

| Aplikacja | Ścieżka | Stack |
|-----------|---------|--------|
| Web | `apps/web` | Next.js (Pages Router) + React |
| API | `apps/api` | FastAPI + SQLAlchemy + SQLite |

Na Vercel: **web publiczny**, **api internal** — przeglądarka woła tylko `/api/*` (BFF w Next), a Next łączy się z FastAPI przez binding `API_URL`.

## Gdzie co uzupełniać

| Plik | Dla kogo | Co wpisywać |
|------|----------|-------------|
| [`docs/team/product.md`](docs/team/product.md) | cały zespół | produkt, domena, słownik, out-of-scope |
| [`docs/team/frontend.md`](docs/team/frontend.md) | frontend + AI | UI, routing, komponenty, design |
| [`docs/team/api.md`](docs/team/api.md) | backend + AI | endpointy, auth, dane |
| [`docs/team/accessibility.md`](docs/team/accessibility.md) | frontend + AI | WCAG 2.1 AA, brak barier |
| [`docs/team/security.md`](docs/team/security.md) | cały zespół + AI | cybersec, authz, sekrety, BFF |
| [`docs/team/ai.md`](docs/team/ai.md) | AI agent | preferencje pracy z agentem |
| [`docs/team/figma.md`](docs/team/figma.md) | UI + AI | Figma MCP, linki do frame’ów |
| [`.cursor/rules/`](.cursor/rules/) | Cursor | krótkie, egzekwowalne reguły (skrót z docs) |
| [`.cursor/mcp.json`](.cursor/mcp.json) | Cursor | Figma remote MCP (`https://mcp.figma.com/mcp`) |

**Figma:** Settings → Tools & MCP → **Connect** przy `figma`, albo w czacie `/add-plugin figma`. Potem wklej link frame’a z `docs/team/figma.md`.

**Workflow:** najpierw uzupełnij `docs/team/*`, potem przenieś kluczowe punkty do `.cursor/rules/*.mdc` (max ~50 linii na plik).

## Lokalne komendy

```bash
npm install && npm run setup:api
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
npm run dev
```

- Web: http://localhost:3000  
- FastAPI (dev only): http://localhost:8000/docs  

## Zasady nie do łamania (skrót)

1. Nie wystawiaj FastAPI publicznie na Vercel — tylko przez BFF / binding.
2. Nie wołaj API z przeglądarki przez `localhost:8000` ani bezpośredni URL serwisu `api`.
3. Nie commituj `.env`, sekretów ani `*.db`.
4. UI: **WCAG 2.1 AA** — szczegóły w `docs/team/accessibility.md` / `accessibility.mdc`.
5. Cybersec: `docs/team/security.md` / `security.mdc` (authz, sekrety, XSS, input).
6. Nowe reguły zespołu → `docs/team/` + ewentualnie `.cursor/rules/`.
