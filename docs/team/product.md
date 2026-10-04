# Produkt i domena

## Nazwa i one-liner

- **Nazwa:** MaloHUB
- **One-liner:** PWA, w której mieszkaniec rozmawia ze społecznym opiekunem, a jednostki i projekty działają „pod spodem”.

## Opis (HackYeah)

Aplikacja webowa (PWA) z dwoma perspektywami:

1. **Admin** — jednostki (teren + kompetencje), projekty, statusy spraw mieszkańców.
2. **Mieszkaniec** — czat ze **społecznym opiekunem** + podgląd **statusów spraw** (bez formularzy, bez listy projektów).
3. **AI** — prowadzi rozmowę; może sugerować projekty / otwierać sprawy (under the hood). UI nie zmusza usera do tych akcji.

## Copy na UI

| Ekran | Element | Tekst |
|-------|---------|--------|
| Landing | Brand | MaloHUB |
| Landing | Headline | Zgłaszaj problemy i wydarzenia w swojej jednostce. |
| Landing | CTA | Porozmawiaj z opiekunem → `#opiekun`, Załóż konto → `/register` |
| Landing | Hero — czat | Ten sam `AssistantChat` co w `/app` (`guestMode`); pełny zapis spraw po koncie |
| Login | Tytuł | Zaloguj się |
| Login | Support | Wróć do zgłoszeń i pomysłów w swojej jednostce. |
| Register | Tytuł | Załóż konto |
| App `/app` | Czat | Witaj, {username} · Twój społeczny opiekun |
| App `/app` | Czat support | Opowiedz, co Cię zajmuje — razem pomyślimy nad rozwiązaniem. |
| App `/app` | Sprawy | Statusy aktualizuje zespół — Ty tylko śledzisz postęp. |
| Admin `/admin` | Intro | Jednostki, projekty, statusy spraw |

Nie używaj na landingu / loginie copy o „panelu administracyjnym” ani stacku (monorepo, API, JWT).

## Użytkownicy

| Persona | Cel | Notatki |
|---------|-----|---------|
| Mieszkaniec / NGO (`user`) | Zgłasza problem / pomysł oddolnie; czat + status spraw | `/app`; zgłoszenie z czatu (`Report`) |
| JST | Katalog gotowych rozwiązań + lokalne wyzwania | czat → karty `UnitProject`; opcjonalnie zgłoszenie |
| ROPS / Admin | Panel: wiedza, jednostki, projekty, monitoring spraw | `/admin` |
| Ekspert branżowy / Mentor (`specialist`) | Doradza w prywatnej rozmowie | rolę nadaje admin; `/kontakt` → Mentorzy, własna skrzynka w Rozmowach |
| AI / czat | Dopasowanie PROJECT\| **lub** offer/zapis zgłoszenia **lub** intake nowego projektu | markery w odpowiedzi LLM |

## Zakres HackYeah (in / out)

**In scope**

- PWA (web) — installable: manifest + ikony + service worker
- Auth / authz (`admin` / `user`)
- Jednostki + projekty (admin)
- Czat mieszkańca (bez export/save)
- Sprawy: status `nowe` / `w_toku` / `zakonczone` (admin zmienia; user czyta)
- API tworzenia spraw (pod AI/system), nie UI mieszkańca
- Dostępność cyfrowa: **WCAG 2.1 poziom AA** (brak barier) — `docs/team/accessibility.md`
- Cyberbezpieczeństwo (BFF, sekrety, authz) — `docs/team/security.md`

**Out of scope (na teraz)**

- Publiczne wystawianie FastAPI na Vercel
- Export / import / zapis rozmowy
- Historia rozmowy / zapis czatu (tylko pojedyncze wiadomości + kontekst DB)
- Mapa GIS

## Słownik domenowy

| Termin | Znaczenie |
|--------|-----------|
| Społeczny opiekun | Persona czatu dla mieszkańca |
| Jednostka | Org unit z terenem i kompetencjami (admin) |
| Projekt | Inicjatywa jednostki — under the hood / sugerowana przez AI |
| Propozycja projektu | Draft z czatu (AI zbiera dane); admin + jednostka zatwierdzają |
| Sprawa | Zapis potrzeby; status widoczny dla mieszkańca |
| Tester | Osoba, która zgłosiła chęć udziału w testach rozwiązania; przyjmuje ją admin |
| Opinia | Ocena 1–5 + informacja zwrotna + propozycja usprawnień do rozwiązania (innowacja / zatwierdzona fiszka); dodaje ją tylko przyjęty tester |
| Rozmowa | Wątek wiadomości między dwiema stronami: pytanie do ROPS, rozmowa z mentorem albo odpowiedź na ogłoszenie partnerskie |
| Zespół ROPS | Wspólna skrzynka adminów; pytający widzi odpowiedzi podpisane „Zespół ROPS”, nie nazwiskiem |
| Mentor | Użytkownik z rolą `specialist` — publiczna wizytówka i prywatne rozmowy |
| Sektor | NGO / samorząd (JST) / biznes / nauka — część profilu, wymagana do dodania ogłoszenia |
| Ogłoszenie partnerskie | Wpis „szukam / oferuję” na tablicy współpracy; odpowiedź otwiera prywatną rozmowę z autorem |
| BFF | Next.js `/api/*` proxy do internal FastAPI |

## Decyzje produktowe (log)

| Data | Decyzja | Dlaczego |
|------|---------|----------|
| 2026-10 | API internal na Vercel | Bezpieczeństwo |
| 2026-10 | Login = mieszkaniec, nie panel admina | Produkt dla mieszkańca |
| 2026-10 | User bez formularza zgłoszeń i listy projektów | Fajna platforma rozmowy; AI/admin under the hood |
| 2026-10 | Admin zmienia statusy spraw | User tylko je widzi |
| 2026-10 | Gemini jako provider czatu | Odpowiedzi z kontekstu jednostek/projektów z DB |
| 2026-10 | Prompt opiekuna w `caretaker_system.md` | Jedno źródło zaleceń formatu (Markdown) pod UI czatu |
| 2026-10 | Intake nowego projektu z czatu | Gdy brak dopasowania — AI zbiera dane, admin tworzy projekt w jednostce |
| 2026-10 | Czat opiekuna na landingu (gość) | Demo bez bariery rejestracji; propozycje do admina tylko po zalogowaniu |
| 2026-10 | Paleta szaro–czarna + `#27227d` / `#3661a8` / `#94c0e5` | Brand zamiast teal |
| 2026-10 | WCAG 2.1 AA jako wymóg produktu | HackYeah / brak barier |
| 2026-10 | Reguły cybersec w docs + `.cursor/rules` | Egzekwowalne dla AI i zespołu |
| 2026-10 | Czat: katalog PROJECT\| + offer/zapis zgłoszenia | Persony HackYeah bez formularza mieszkańca |
| 2026-10 | Tryby czatu: clarify / report / catalog / intake | Zgłoszenie ≠ katalog — twarde bramki API |
| 2026-10 | Tester innowacji: opinie publiczne, zgłoszenia do testów zatwierdza admin | Pętla zwrotna dla innowacji i fiszek bez osobnych kampanii testów |
| 2026-10 | Platforma komunikacji `/kontakt`: pytania do ROPS, mentorzy, ogłoszenia partnerskie na jednym modelu rozmowy | Bezpośredni dialog ROPS ↔ użytkownicy i partnerstwa międzysektorowe; uzupełnia czat AI, nie zastępuje go |
| 2026-10 | Mentor = rola `specialist` nadawana przez admina | Bez osobnego procesu zgłoszeń; ROPS zna swoich ekspertów |
| 2026-10 | Middleman Innowacji `/admin/middleman`: karta usługi z innowacji + kontekstu instytucji, bez zapisu w bazie; tylko admin | Moduł VII wyzwania; kartę przygotowuje zespół ROPS dla zgłaszającej się instytucji |
| 2026-10 | Decyzja o fiszce = wiadomość od Zespołu ROPS w Rozmowach + komentarz przy fiszce | Autor dostaje odpowiedź tam, gdzie ma już licznik nieprzeczytanych |
| 2026-10 | „Podobne przypadki” w czacie: tylko liczby i zatwierdzone fiszki | Cudze opisy potrzeb mogą zawierać dane osobowe |
| 2026-10 | Limity wywołań AI liczone w bazie (gość po IP, zalogowany po koncie) | Koszt LLM; instancje serverless nie dzielą pamięci |
| 2026-10 | Usunięte Jednostki, Projekty jednostek i Sprawy (widoki, endpointy, modele) | Pozostałość pierwszej koncepcji; nic ich już nie tworzyło. Propozycję z czatu admin akceptuje bez przypisywania jednostki |
| 2026-10 | Nowe wiadomości przez odpytywanie co 5 s, nie WebSocket | Proxy BFF buforuje odpowiedzi; działa na Vercel bez zmian w infrastrukturze |
