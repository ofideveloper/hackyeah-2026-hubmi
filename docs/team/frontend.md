# Frontend - reguły zespołu

Stack: Next.js 15 **Pages Router** w `apps/web` (`src/pages`, `src/components`, `src/lib`).

> Uwaga: w repo mogą leżeć stare pliki pod `src/app/` - **nie rozwijaj App Router**, dopóki zespół nie zdecyduje inaczej. Źródło prawdy to Pages Router.

## Routing (aktualne)

| Ścieżka            | Rola                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | Landing - w hero ten sam `AssistantChat` co w `/app` (`guestMode`, `#opiekun`)                                                                                                            |
| `/login`           | Logowanie → admin: `/admin`, user: `/app`                                                                                                                                                 |
| `/register`        | Rejestracja → `/login`                                                                                                                                                                    |
| `/app`             | Dom mieszkańca: czat + statusy spraw (bez formularzy)                                                                                                                                     |
| `/admin`           | Panel admin - przegląd (tylko `role=admin`)                                                                                                                                               |
| `/admin/units`     | Jednostki - create + edycja (`name`/`territory`/`competencies`) + delete                                                                                                                  |
| `/admin/projects`  | Projekty jednostek (`UnitProject`) - create + pełna edycja + delete                                                                                                                       |
| `/admin/catalog`   | Katalog projektów z bazy (`ActualProject`) - przegląd, szukanie, szczegóły (tylko odczyt, przez `/knowledge`)                                                                             |
| `/admin/proposals` | Propozycje projektów z czatu → jednostka                                                                                                                                                  |
| `/admin/reports`   | Sprawy / statusy                                                                                                                                                                          |
| `/admin/users`     | Użytkownicy + nadanie / odebranie roli mentora                                                                                                                                            |
| `/wiedza`          | Zasobnik wiedzy (publiczny): wyzwania, Biblioteka Innowacji (`ActualProject`), materiały                                                                                                  |
| `/admin/knowledge` | Redakcja zasobów Zasobnika (`KnowledgeResource`) + dociąganie nowych innowacji                                                                                                            |
| `/admin/trends`    | Trendy potrzeb z czatu wg obszarów (`NeedSignal`) - tylko admin                                                                                                                           |
| `/kreator`         | Kreator pomysłów: publiczna lista fiszek; po zalogowaniu fiszka + canva + asystent AI; generator wniosków tylko przy trwającym naborze                                                    |
| `/admin/ideas`     | Fiszki z Kreatora pomysłów - podgląd (autor, canva), zatwierdź / odrzuć / usuń                                                                                                            |
| `/admin/grants`    | Nabory grantowe - terminy, pola wniosku, podgląd złożonych wniosków                                                                                                                       |
| `/tester`          | Tester innowacji: publiczna lista rozwiązań z ocenami i opiniami; po zalogowaniu zgłoszenie do testów, a po jego przyjęciu opinia (ocena, feedback, usprawnienia) i „Moje testy i opinie” |
| `/admin/testing`   | Zgłoszenia testerów (przyjmij / odrzuć) i moderacja opinii                                                                                                                                |
| `/kontakt`         | Platforma komunikacji: zakładki Rozmowy (pytania do ROPS, wątki z mentorami i partnerami - po zalogowaniu), Mentorzy i Partnerstwa (tablica ogłoszeń - publiczne); profil z sektorem      |
| `/profil`          | Konto zalogowanego: dane + zmiana hasła; wejście z dropdownu przy kółku użytkownika w `AppNav`                                                                                            |
| `/admin/messages`  | Wspólna skrzynka ROPS - pytania użytkowników, odpowiedź, zamknięcie rozmowy                                                                                                               |
| `/admin/login`     | Redirect → `/login`                                                                                                                                                                       |
| `/api/*`           | BFF → FastAPI (nie UI)                                                                                                                                                                    |

Flow usera: rozmowa z interaktywnym asystentem + podgląd statusów.
Projekty / tworzenie spraw: under the hood (AI / API), nie UI mieszkańca.

**Czat / Markdown:** `AssistantChat` → `ChatMarkdown` (`react-markdown` + GFM). AI ma odpowiadać wg `apps/api/app/llm/prompts/caretaker_system.md` (bold, listy, `###`, linki - bez tabel/kodu). Landing: `<AssistantChat guestMode />` w `#opiekun` (bez JWT). App: z `userName`.

**Czat:** bez chipów ścieżek - użytkownik opisuje sprawę własnymi słowami.

- `catalog` → karty PROJECT\|
- `report` → zbieranie + `report_offer` / `created_report` (bez sugestii projektów)
- `intake` → `project_proposal`  
  JWT opcjonalny. Admin: `/admin/proposals`.

**Rozmowy (`components/communication/`):** `ThreadList` + `ThreadView` są wspólne dla `/kontakt` i `/admin/messages`; `ComposeDialog` otwiera nową rozmowę. `ThreadView` odpytuje `GET /conversations/{id}` co 5 s (pauza, gdy karta jest w tle; stop po 401/404), a listę odświeża `hooks/useThreads.ts` co 15 s. Historia to `<ol role="log" aria-live="polite">`, każda wiadomość ma autora tekstem („Ty” / nazwa), treść renderowana jako czysty tekst (bez Markdown / HTML). Etykiety i limity: `lib/communication.ts`.

## Architektura wywołań API

```
Browser  →  fetch("/api/...")  →  pages/api/[...path].ts  →  process.env.API_URL  →  FastAPI
```

**Rób**

- Klient tylko przez `@/lib/api.ts` i ścieżki `/api/...`
- JWT nie jest dostępny w kliencie - siedzi w cookie HttpOnly ustawianym przez BFF; funkcje z `@/lib/api` nie przyjmują tokena. `@/lib/auth.ts` ma tylko znacznik `hubmi_auth` (bootstrap / odzyskanie sesji)
- Sesja: `_app.getInitialProps` czyta cookie i woła FastAPI `/auth/me` (przez `lib/server/upstream.ts`) → `AuthProvider(initialUser)` zna usera przed pierwszym renderem; potem cache w `useAuth`
- W widokach: `useAuth().isLoggedIn` (nav/CTA), `useAuth().canUseSession` (mutacje / chronione fetche). Nie bramkuj `useEffect` samym `hasSessionHint()` z pustymi deps
- BFF czyści cookie tylko przy `401` z `/auth/me`, nie przy każdym 401 z API

**Nie rób**

- `NEXT_PUBLIC_*` z URL-em FastAPI / serwisu `api`
- Bezpośrednich `fetch("http://localhost:8000/...")` z komponentów
- Logiki autoryzacji „na sztywno” poza `useAuth` / `useRequireAdmin`
- `fetchMe` ani wylogowania przy dowolnym błędzie sieci w widoku — to robi wyłącznie AuthProvider przy prawdziwym 401

## Komponenty i struktura

```
src/
  pages/        # trasy Pages Router
  components/   # UI (formularze, panele)
  lib/          # api, auth, utils
  styles/       # globals
```

- Wspólny header: `SiteHeader` + `AppNav` (desktop od `lg`, poniżej hamburger / drawer - gość i zalogowany)
- Admin: `AdminShell` + `useRequireAdmin` (JWT + role); podwidoki w `pages/admin/*`
- PWA: `public/manifest.json`, `public/favicons/`, `public/browserconfig.xml`, `public/sw.js`

## Design / UI (aktualny baseline)

Motyw: **light**, szaro–czarny + ciepły brąz brand. Tokeny: `apps/web/src/styles/globals.css` - dobrane pod **WCAG 2.1 AA** (kontrast liczony na `--bg` i `--bg-elevated`).

| Token                                                 | Rola                                                                    | Kontrast                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| `--bg` `#f3f5f8`                                      | tło                                                                     | -                          |
| `--bg-elevated` `#ffffff`                             | surface formularzy / tabeli                                             | -                          |
| `--text` `#12131a`                                    | tekst; także tekst i obrysy w headerze (`#ada399`)                      | 17:1 / 7.5:1 na headerze   |
| `--muted` `#525a69`                                   | opis                                                                    | 6.4:1                      |
| `--accent` `#6b5c4e`                                  | CTA / brand, tekst akcentu, tło pod biały tekst                         | 5.9:1 (biały na nim 6.4:1) |
| `--accent-hover` `#54473b`                            | hover / głęboki brand                                                   | 8.2:1                      |
| `--accent-light` `#a8927e`                            | **tylko dekoracja** - nie pod biały tekst (3:1)                         | -                          |
| `--border` `#d5dae3`                                  | linie dekoracyjne, karty                                                | -                          |
| `--border-strong` `#7c8494`                           | granice pól, chipów, przycisków outline                                 | 3.4:1                      |
| `--danger` `#a82a2a` / `--success` `#1f6b4a`          | błędy / potwierdzenia                                                   | 6.3:1 / 5.9:1              |
| `--focus` `#12131a`                                   | globalny `:focus-visible` (obrys 2 px); na ciemnym headerze biały obrys | ≥ 3:1                      |
| `.btn-primary` / `.btn-ghost` / `.field` / `.surface` | wspólne klasy UI                                                        |                            |

- Fokus: **nie nadpisuj** `outline` lokalnie - globalny `:focus-visible` działa na jasnych i ciemnych tłach
- Header ma jasne tło → tekst `--text`, nie biały
- Linki w treści: zawsze podkreślone (nie tylko kolor)
- Tło strony (`background.png`) jest przykryte nakładką ≥ 90% - nie zmniejszaj, bo ilustracje obniżą kontrast tekstu

- Typografia: **Sora** (display / brand), **Manrope** (body) - `pages/_app.tsx`
- Karty tylko przy interakcji (formularze, tabela); hero bez kart
- Motion: `animate-fade-up`, `animate-soft-in` na landing / formach

**Figma (team UI):** setup + linki w [`figma.md`](./figma.md). Po akceptacji designu z Figmy zaktualizuj tokeny tutaj i w `globals.css`.

**Design do unikania (domyślne AI looks):** fioletowe gradienty, cream+terracotta+serif „AI brochure”, broadsheet/newspaper layout, ciężki dark mode - chyba że świadomie z Figmy.

## Stan i dane

- [UZUPEŁNIJ - czy React Query / Zustand / tylko useState]
- Błędy API: pokazuj `detail` z FastAPI użytkownikowi w formie czytelnego komunikatu

## Dostępność

Wymóg: **WCAG 2.1 AA** - reguły i checklista: [`accessibility.md`](./accessibility.md); egzekucja AI: `.cursor/rules/accessibility.mdc`.

## Checklist PR (frontend)

- [ ] Działa na mobile i desktop
- [ ] Auth redirect działa bez tokena
- [ ] Brak sekretów w kliencie
- [ ] Wywołania tylko przez `/api` + `lib/api.ts`
- [ ] WCAG 2.1 AA: klawiatura, focus, label, kontrast, `aria-label` na ikonach (patrz `accessibility.md`)
