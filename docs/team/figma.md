# Figma MCP — UI team

Agent w Cursorze może czytać frame’y z Figmy koleżanek z teamu UI i wdrażać je w `apps/web`.

## Połączenie (raz na osobę)

**Opcja A — plugin (zalecane)**

W czacie agenta Cursor:

```text
/add-plugin figma
```

Potem: **Cursor Settings → Tools & MCP → Connect** przy Figma (OAuth).

**Opcja B — ten repo**

W projekcie jest [`.cursor/mcp.json`](../../.cursor/mcp.json) z remote MCP:

```json
"figma": { "url": "https://mcp.figma.com/mcp" }
```

1. Otwórz **Cursor Settings → Tools & MCP**
2. Przy `figma` kliknij **Connect** / **Authenticate**
3. Zaloguj się kontem Figma z dostępem do plików zespołu

Docs: [Cursor + Figma MCP](https://help.figma.com/hc/en-us/articles/39889260656407-Cursor-and-Figma-Set-up-the-MCP-server) · [Remote server](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)

## Pliki Figmy zespołu

Wklej linki (file / frame). Agent potrzebuje URL z `node-id`.

| Ekran / flow | Link Figma | Owner | Status |
|--------------|------------|-------|--------|
| Design system / tokens | [UZUPEŁNIJ] | | |
| Landing `/` | [UZUPEŁNIJ] | | |
| Admin login | [UZUPEŁNIJ] | | |
| Admin panel | [UZUPEŁNIJ] | | |
| Rejestracja | [UZUPEŁNIJ] | | |
| [UZUPEŁNIJ] | | | |

## Jak pracować z agentem

1. W Figmie: zaznacz frame → **Copy link**.
2. W Cursorze:

```text
Zaimplementuj ten design w apps/web (Pages Router).
Link: https://www.figma.com/design/…?node-id=…
Trzymaj tokeny z globals.css / docs/team/frontend.md.
Nie wystawiaj API publicznie — tylko BFF /api.
```

3. Po akceptacji UI: zaktualizuj tokeny w `apps/web/src/styles/globals.css` i wpisz decyzję w `docs/team/frontend.md`.

## Uprawnienia

- Konto Figma musi mieć **view** (min.) do pliku zespołu.
- Nie commituj tokenów OAuth — autoryzacja jest lokalna w Cursorze.
- Linki do plików trzymaj w tej tabeli (nie w `.env`).
