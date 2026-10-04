import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";

/**
 * Model to lokalna atrapa (`e2e/llm-stub.mjs`): domyślnie dopytuje, po znaczniku
 * `[e2e:match]` wskazuje pierwszy projekt z katalogu, a po `[e2e:no-match]` zwraca
 * szkic nowego projektu. Sprawdzamy przepływ, nie treść.
 */
async function askCaretaker(page: Page, text: string) {
  const assistant = page.locator('[data-role="assistant"]');
  const input = page.locator("#chat-message-input");
  await expect(input).toBeEnabled();
  const before = await assistant.count();

  await input.fill(text);
  await page.getByRole("button", { name: "Wyślij wiadomość" }).click();

  await expect(page.locator('[data-role="user"]').last()).toContainText(text);
  await expect.poll(() => assistant.count()).toBeGreaterThan(before);
  // Znaczniki sterujące z odpowiedzi modelu nie trafiają do użytkownika
  await expect(assistant.last()).not.toContainText("[[hubmi");
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("");
  return assistant.last();
}

test("gość dostaje odpowiedź opiekuna na landingu", async ({ page }) => {
  await page.goto("/");
  const reply = await askCaretaker(page, "Potrzebuję pomocy");
  await expect(reply).toContainText("Kogo dotyczy sprawa");
});

test("dopasowanie pokazuje kartę projektu z katalogu", async ({ userPage: page }) => {
  await page.goto("/app");
  await askCaretaker(page, "Szukam wsparcia dla samotnych seniorów [e2e:match]");
  const suggestions = page.getByLabel("Sugerowane projekty");
  await expect(suggestions.getByRole("button").first()).toBeVisible();
});

test("rozmowa ma ciąg dalszy — kolejne pytanie dostaje odpowiedź", async ({ userPage: page }) => {
  await page.goto("/app");
  await askCaretaker(page, "Dzień dobry");
  await askCaretaker(page, "Chodzi o opiekę wytchnieniową");
  await expect(page.locator('[data-role="user"]')).toHaveCount(2);
});
