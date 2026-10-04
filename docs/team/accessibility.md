# Dostępność (WCAG 2.1 AA)

**Wymóg produktowy:** narzędzie musi spełniać **WCAG 2.1 poziom AA** — brak barier dla użytkowników z niepełnosprawnościami (wzrok, słuch, motoryka, kognitywne).

Źródło skrótu dla AI: `.cursor/rules/accessibility.mdc`.

## Zakres

Dotyczy całego UI w `apps/web` (landing, auth, `/app`, `/admin`, czat, statusy spraw, PWA).

## Zasady (POUR → praktyka)

### Perceivable

- Semantyka HTML: `h1`–`h3` w logicznej kolejności; jeden `h1` na widok
- Obrazy informacyjne: `alt` opisujący treść; dekoracyjne: `alt=""`
- Kolor nie jest jedynym nośnikiem informacji (statusy: tekst + ikona / wzór, nie tylko kolor)
- Kontrast tekstu i UI: min. **4.5:1** (normalny tekst), **3:1** (duży tekst / ikony / obramowania kontrolek) względem tła
- Tokeny w `globals.css` utrzymuj powyżej tych progów (szczególnie `--muted` na `--bg`)
- Granice kontrolek: `--border-strong` (3:1); `--border` tylko dekoracyjnie. `--accent-light` nie nadaje się pod biały tekst
- Linki w tekście zawsze podkreślone; fokus z globalnego `:focus-visible` (`--focus` + `--focus-halo`)

### Operable

- Pełna obsługa **klawiaturą** (Tab / Shift+Tab / Enter / Esc): nawigacja, formularze, czat, dialogi, admin
- Widoczny **focus** (`:focus-visible`) — nie usuwaj outline bez zamiennika
- Nie polegaj wyłącznie na geście / hover; klik / klawiatura wystarczą
- Unikaj treści migających / autoplay; motion respektuj `prefers-reduced-motion`
- Skip link „Przejdź do treści” jest globalny (`pages/_app.tsx`) — każdy widok musi mieć `<main id="tresc" tabIndex={-1}>`
- Bez limitów czasu: toast (`components/Toast.tsx`) nie znika sam; komunikaty po przekierowaniu pokazuj na stronie docelowej (np. `/login?registered=1`)
- PWA nie blokuje orientacji (`"orientation": "any"` w manifestach)

### Understandable

- Etykiety formularzy: `<label htmlFor>` powiązane z kontrolką (nie tylko placeholder)
- Błędy walidacji: tekst przy polu + `aria-invalid` / `aria-describedby`; błąd ogólny z API: `role="alert"` + `aria-describedby` na `<form>`
- Pola wymagane: atrybut `required` w `<label><span>…</span><input/></label>` — dopisek „(wymagane)” dodaje CSS
- `autoComplete` na polach z danymi osobowymi (imię, e-mail, telefon, organizacja, hasła)
- Język strony: `lang="pl"` w `_document` / root HTML
- Spójne nazwy przycisków i stanów (PL, bez żargonu technicznego dla mieszkańca)

### Robust

- Interaktywne elementy: natywne `<button>`, `<a href>`, `<input>` — unikaj `div onClick` bez roli i klawiatury
- Ikony-przyciski: `aria-label` (np. „Wyślij wiadomość”, „Zamknij”)
- Live region dla odpowiedzi czatu / toastów: `aria-live="polite"` (lub `assertive` przy krytycznych błędach)
- Modale: tylko natywny `<dialog>` + `showModal()` (wzór: `components/knowledge/InnovationDialog.tsx`) — pułapka fokusu, Escape i powrót fokusu gratis
- Rozwijane listy linków (menu konta): wzorzec disclosure (`aria-expanded` + `aria-controls`), **nie** `role="menu"` bez obsługi strzałek
- Aktywna pozycja nawigacji: `aria-current="page"`; tabele: `<caption>` + `<th scope="col">`
- Dekoracyjne SVG: `aria-hidden="true"` + `focusable="false"`

## Czat i AI (specyfika MaloHUB)

- Pole wiadomości i przycisk wyślij dostępne z klawiatury; Enter = wyślij, Shift+Enter = nowa linia (jeśli wieloliniowe)
- Historia wiadomości w czytelnej strukturze (lista / region z nagłówkiem)
- Markdown w odpowiedziach: nagłówki, listy, linki — nie tabele ani bloki kodu (zgodnie z promptem opiekuna)
- Sugestie projektów / karty lokalizacji: fokusowalne, z czytelną etykietą akcji

## Checklist PR (a11y)

- [ ] Nawigacja i główne ścieżki działają bez myszy
- [ ] Formularze mają label + komunikaty błędów powiązane z polem
- [ ] Kontrast AA dla tekstu i kontrolek na użytych tłach
- [ ] Ikony-only mają `aria-label`
- [ ] Brak pułapek fokusu; dialogi zamykane Esc
- [ ] `prefers-reduced-motion` respektowany przy nowych animacjach
- [ ] `lang` i semantyka nagłówków OK na zmienionych widokach

## Ostatni audyt automatyczny

2026-10-04 · `@axe-core/cli` (axe 4.13), tagi `wcag2a, wcag2aa, wcag21a, wcag21aa`, build produkcyjny,
szerokość okna domyślna (menu mobilne), bez logowania.

| Strony | Wynik |
|--------|-------|
| `/`, `/wiedza`, `/kreator`, `/tester`, `/kontakt`, `/login`, `/register` | 0 naruszeń |

Poprawione w tym przebiegu: biały tekst na headerze `#ada399` (2.5:1), fokus w zamkniętym panelu
mobilnym (`inert`), kolor placeholderów, link odróżniony tylko kolorem na `/login`, tekst w kolorze
`--accent` na tle strony, brak widocznego fokusu w polach formularzy i czacie, skip link na każdej stronie.

Poza zakresem przebiegu (do sprawdzenia): widoki po zalogowaniu (`/app`, `/profil`), panel admina,
otwarte dialogi, układ desktopowy. Axe wykrywa tylko część problemów — lista testów ręcznych niżej nadal obowiązuje.

Powtórzenie: `npm run build -w @hubmi/web && npx next start -p 3011` (w `apps/web`), potem
`npx @axe-core/cli http://localhost:3011/… --tags wcag2a,wcag2aa,wcag21a,wcag21aa --load-delay 2500`
(opóźnienie, bo animacje wejścia fałszują pomiar kontrastu).

## Narzędzia

- `npm run lint` — zawiera `jsx-a11y/recommended` (`apps/web/eslint.config.mjs`); build nie przejdzie z błędami a11y

- Lighthouse / axe DevTools na landing, login, `/app`, kluczowy ekran admina
- Test ręczny: Tab przez flow „zaloguj → napisz do opiekuna → zobacz status”

### Tylko test ręczny (nie widać w kodzie ani w lincie)

- 1.4.10 Reflow: szerokość 320 px bez poziomego scrolla (poza tabelami admina)
- 1.4.4 Zoom 200% i 1.4.12 odstępy tekstu (bookmarklet „text spacing”)
- 1.3.4 Obrót ekranu w zainstalowanej PWA
- Czytnik ekranu (VoiceOver / NVDA): logowanie, rejestracja z błędem, czat, dialogi
- 1.2.x Napisy w filmach z Zasobnika — zależą od materiału na YouTube
