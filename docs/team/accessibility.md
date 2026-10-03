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

### Operable

- Pełna obsługa **klawiaturą** (Tab / Shift+Tab / Enter / Esc): nawigacja, formularze, czat, dialogi, admin
- Widoczny **focus** (`:focus-visible`) — nie usuwaj outline bez zamiennika
- Nie polegaj wyłącznie na geście / hover; klik / klawiatura wystarczą
- Unikaj treści migających / autoplay; motion respektuj `prefers-reduced-motion`
- Skip link do głównej treści na stronach z nawigacją (np. „Przejdź do treści”)

### Understandable

- Etykiety formularzy: `<label htmlFor>` powiązane z kontrolką (nie tylko placeholder)
- Błędy walidacji: tekst przy polu + `aria-invalid` / `aria-describedby`
- Język strony: `lang="pl"` w `_document` / root HTML
- Spójne nazwy przycisków i stanów (PL, bez żargonu technicznego dla mieszkańca)

### Robust

- Interaktywne elementy: natywne `<button>`, `<a href>`, `<input>` — unikaj `div onClick` bez roli i klawiatury
- Ikony-przyciski: `aria-label` (np. „Wyślij wiadomość”, „Zamknij”)
- Live region dla odpowiedzi czatu / toastów: `aria-live="polite"` (lub `assertive` przy krytycznych błędach)
- Modale / drawer: fokus w pułapce, Escape zamyka, powrót fokusu do triggera

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

## Narzędzia (opcjonalnie lokalnie)

- Lighthouse / axe DevTools na landing, login, `/app`, kluczowy ekran admina
- Test ręczny: Tab przez flow „zaloguj → napisz do opiekuna → zobacz status”
