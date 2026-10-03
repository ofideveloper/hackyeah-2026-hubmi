# Frontend — reguły zespołu

Stack: Next.js 15 **Pages Router** w `apps/web` (`src/pages`, `src/components`, `src/lib`).

> Uwaga: w repo mogą leżeć stare pliki pod `src/app/` — **nie rozwijaj App Router**, dopóki zespół nie zdecyduje inaczej. Źródło prawdy to Pages Router.

## Routing (aktualne)

| Ścieżka | Rola |
|---------|------|
| `/` | Landing — w hero ten sam `AssistantChat` co w `/app` (`guestMode`, `#opiekun`) |
| `/login` | Logowanie → admin: `/admin`, user: `/app` |
| `/register` | Rejestracja → `/login` |
| `/app` | Dom mieszkańca: czat + statusy spraw (bez formularzy) |
| `/admin` | Panel admin — przegląd (tylko `role=admin`) |
| `/admin/units` | Jednostki — create + edycja (`name`/`territory`/`competencies`) + delete |
| `/admin/projects` | Projekty jednostek (`UnitProject`) — create + pełna edycja + delete |
| `/admin/catalog` | Katalog projektów z bazy (`ActualProject`) — przegląd, szukanie, szczegóły (tylko odczyt, przez `/knowledge`) |
| `/admin/proposals` | Propozycje projektów z czatu → jednostka |
| `/admin/reports` | Sprawy / statusy |
| `/admin/users` | Użytkownicy + nadanie / odebranie roli mentora |
| `/wiedza` | Zasobnik wiedzy (publiczny): wyzwania, Biblioteka Innowacji (`ActualProject`), materiały |
| `/admin/knowledge` | Redakcja zasobów Zasobnika (`KnowledgeResource`) + dociąganie nowych innowacji |
| `/admin/trends` | Trendy potrzeb z czatu wg obszarów (`NeedSignal`) — tylko admin |
| `/kreator` | Kreator pomysłów: publiczna lista fiszek; po zalogowaniu fiszka + canva + asystent AI; generator wniosków tylko przy trwającym naborze |
| `/admin/ideas` | Fiszki z Kreatora pomysłów — podgląd (autor, canva), zatwierdź / odrzuć / usuń |
| `/admin/grants` | Nabory grantowe — terminy, pola wniosku, podgląd złożonych wniosków |
| `/tester` | Tester innowacji: publiczna lista rozwiązań z ocenami i opiniami; po zalogowaniu zgłoszenie do testów, a po jego przyjęciu opinia (ocena, feedback, usprawnienia) i „Moje testy i opinie” |
| `/admin/testing` | Zgłoszenia testerów (przyjmij / odrzuć) i moderacja opinii |
| `/kontakt` | Platforma komunikacji: zakładki Rozmowy (pytania do ROPS, wątki z mentorami i partnerami — po zalogowaniu), Mentorzy i Partnerstwa (tablica ogłoszeń — publiczne); profil z sektorem |
| `/profil` | Konto zalogowanego: dane + zmiana hasła; wejście z dropdownu przy kółku użytkownika w `AppNav` |
| `/admin/messages` | Wspólna skrzynka ROPS — pytania użytkowników, odpowiedź, zamknięcie rozmowy |
| `/admin/login` | Redirect → `/login` |
| `/api/*` | BFF → FastAPI (nie UI) |

Flow usera: rozmowa ze społecznym opiekunem + podgląd statusów.
Projekty / tworzenie spraw: under the hood (AI / API), nie UI mieszkańca.

**Czat / Markdown:** `AssistantChat` → `ChatMarkdown` (`react-markdown` + GFM). AI ma odpowiadać wg `apps/api/app/llm/prompts/caretaker_system.md` (bold, listy, `###`, linki — bez tabel/kodu). Landing: `<AssistantChat guestMode />` w `#opiekun` (bez JWT). App: z `userName`.

**Czat — tryby:** `clarify` | `report` | `catalog` | `intake` (chip ustawia `mode` w `POST /chat`).  
- `catalog` → karty PROJECT\|  
- `report` → zbieranie + `report_offer` / `created_report` (bez sugestii projektów)  
- `intake` → `project_proposal`  
JWT opcjonalny. Admin: `/admin/proposals`, `/admin/reports`.

**Rozmowy (`components/communication/`):** `ThreadList` + `ThreadView` są wspólne dla `/kontakt` i `/admin/messages`; `ComposeDialog` otwiera nową rozmowę. `ThreadView` odpytuje `GET /conversations/{id}` co 5 s (pauza, gdy karta jest w tle; stop po 401/404), a listę odświeża `hooks/useThreads.ts` co 15 s. Historia to `<ol role="log" aria-live="polite">`, każda wiadomość ma autora tekstem („Ty” / nazwa), treść renderowana jako czysty tekst (bez Markdown / HTML). Etykiety i limity: `lib/communication.ts`.

## Architektura wywołań API

```
Browser  →  fetch("/api/...")  →  pages/api/[...path].ts  →  process.env.API_URL  →  FastAPI
```

**Rób**

- Klient tylko przez `@/lib/api.ts` i ścieżki `/api/...`
- Token JWT w kliencie przez `@/lib/auth.ts` (localStorage)

**Nie rób**

- `NEXT_PUBLIC_*` z URL-em FastAPI / serwisu `api`
- Bezpośrednich `fetch("http://localhost:8000/...")` z komponentów
- Logiki autoryzacji „na sztywno” poza wspólnymi helperami

## Komponenty i struktura

```
src/
  pages/        # trasy Pages Router
  components/   # UI (formularze, panele)
  lib/          # api, auth, utils
  styles/       # globals
```

- Wspólny header: `SiteHeader`
- Admin: `AdminShell` + `useRequireAdmin` (JWT + role); podwidoki w `pages/admin/*`
- PWA: `public/manifest.webmanifest`, `public/icons/`, `public/sw.js`

## Design / UI (aktualny baseline)

Motyw: **light**, szaro–czarny + niebieski brand. Tokeny: `apps/web/src/styles/globals.css`.

| Token | Rola |
|-------|------|
| `--bg` `#f3f5f8` | tło |
| `--bg-elevated` `#ffffff` | surface formularzy / tabeli |
| `--text` `#12131a` | tekst (blisko czerni) |
| `--muted` `#5c6474` | opis |
| `--accent` `#3661a8` | CTA / brand |
| `--accent-hover` `#27227d` | hover / głęboki brand |
| `--accent-light` `#94c0e5` | miękkie highlighty / gradienty |
| `.btn-primary` / `.btn-ghost` / `.field` / `.surface` | wspólne klasy UI |

- Typografia: **Sora** (display / brand), **Manrope** (body) — `pages/_app.tsx`
- Karty tylko przy interakcji (formularze, tabela); hero bez kart
- Motion: `animate-fade-up`, `animate-soft-in` na landing / formach

**Figma (team UI):** setup + linki w [`figma.md`](./figma.md). Po akceptacji designu z Figmy zaktualizuj tokeny tutaj i w `globals.css`.

**Design do unikania (domyślne AI looks):** fioletowe gradienty, cream+terracotta+serif „AI brochure”, broadsheet/newspaper layout, ciężki dark mode — chyba że świadomie z Figmy.

## Stan i dane

- [UZUPEŁNIJ — czy React Query / Zustand / tylko useState]
- Błędy API: pokazuj `detail` z FastAPI użytkownikowi w formie czytelnego komunikatu

## Dostępność

Wymóg: **WCAG 2.1 AA** — reguły i checklista: [`accessibility.md`](./accessibility.md); egzekucja AI: `.cursor/rules/accessibility.mdc`.

## Checklist PR (frontend)

- [ ] Działa na mobile i desktop
- [ ] Auth redirect działa bez tokena
- [ ] Brak sekretów w kliencie
- [ ] Wywołania tylko przez `/api` + `lib/api.ts`
- [ ] WCAG 2.1 AA: klawiatura, focus, label, kontrast, `aria-label` na ikonach (patrz `accessibility.md`)
