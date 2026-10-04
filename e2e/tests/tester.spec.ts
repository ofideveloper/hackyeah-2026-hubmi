import { expect, SAME_ORIGIN, statusWith, test } from "../fixtures";

test("zgłoszenie do testów, przyjęcie przez zespół i opinia", async ({ userPage: page, adminApi }) => {
  await page.goto("/tester");
  const card = page.locator("#rozwiazania .kb-card-button").first();
  const name = (await card.locator(".font-display").innerText()).trim();
  await card.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name, level: 2 })).toBeVisible();
  // Bez przyjętego zgłoszenia nie ma formularza oceny
  await expect(dialog.getByRole("button", { name: "Wyślij opinię" })).toHaveCount(0);

  await dialog.getByLabel(/Dlaczego chcesz testować/).fill("Prowadzę klub seniora w gminie.");
  await dialog.getByRole("button", { name: "Chcę testować" }).click();
  await expect(statusWith(page, /Zgłoszono chęć testowania/)).toBeVisible();

  const mine = page.getByRole("region", { name: "Moje testy i opinie" });
  await page.keyboard.press("Escape");
  await expect(mine.getByText("Czeka na decyzję")).toBeVisible();

  // Decyzja zespołu — tu przez API; klikany wariant jest w admin/testing.spec.ts
  const signups = (await (await page.request.get("/api/testing/mine")).json()).signups as {
    id: string;
  }[];
  expect(signups).toHaveLength(1);
  const decision = await adminApi.patch(`/api/admin/testing/signups/${signups[0].id}`, {
    headers: SAME_ORIGIN,
    data: { status: "approved" },
  });
  expect(decision.status()).toBe(200);

  await page.reload();
  await expect(mine.getByText("Przyjęto do testów")).toBeVisible();
  await mine.getByRole("button", { name }).click();

  await dialog.locator("label.rating-option").filter({ hasText: "5" }).click();
  await dialog.getByLabel(/Informacja zwrotna/).fill("Działa dobrze w małej grupie.");
  await dialog.getByLabel(/Propozycja usprawnień/).fill("Przydałby się krótszy scenariusz.");
  await dialog.getByRole("button", { name: "Wyślij opinię" }).click();
  await expect(statusWith(page, "Dziękujemy za opinię.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(mine.getByText("5 / 5")).toBeVisible();
});

test("zgłoszenie można wycofać", async ({ userPage: page }) => {
  await page.goto("/tester");
  await page.locator("#rozwiazania .kb-card-button").first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("button", { name: "Chcę testować" }).click();
  await expect(statusWith(page, /Zgłoszono chęć testowania/)).toBeVisible();

  await dialog.getByRole("button", { name: /^Wycofaj/ }).click();
  await expect(statusWith(page, "Wycofano zgłoszenie do testów.")).toBeVisible();
  expect((await (await page.request.get("/api/testing/mine")).json()).signups).toHaveLength(0);
});

test("anonim widzi rozwiązania, ale zgłosić się może dopiero po zalogowaniu", async ({ page }) => {
  await page.goto("/tester");
  await page.locator("#rozwiazania .kb-card-button").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Chcę testować" })).toHaveCount(0);
});
