# Praca z agentem AI (Cursor)

## Zawsze czytaj najpierw

1. `AGENTS.md`
2. `.cursor/rules/` (automatycznie)
3. Odpowiedni plik w `docs/team/` przy większych zmianach

## Preferencje zespołu

- Język odpowiedzi do ludzi: [UZUPEŁNIJ — pl / en]
- Commituj tylko na prośbę
- Nie dodawaj nieproszonych markdownów poza `docs/team` / regułami
- Preferuj małe, celowane diffy

## Co agent może / nie może

**Może**

- Implementować features w `apps/web` i `apps/api`
- Aktualizować reguły po decyzjach zespołu
- Uruchamiać `npm run lint` / lokalne skrypty

**Nie może (bez osobnej zgody)**

- Publicznie wystawiać serwis `api` na Vercel
- Commitować `.env`, credentiale, bazy
- [UZUPEŁNIJ]

## Szablon promptu dla feature

```
Kontekst: HubMI (apps/web Pages + apps/api FastAPI, BFF /api).
Cel: [UZUPEŁNIJ]
Ograniczenia: [UZUPEŁNIJ]
Definition of done: [UZUPEŁNIJ]
```

## Po decyzji zespołu

1. Dopisz wpis do `docs/team/product.md` (log decyzji) lub właściwego pliku.
2. Skróć do reguły w `.cursor/rules/*.mdc` jeśli ma być egzekwowana przez AI.
