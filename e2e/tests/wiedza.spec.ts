import { expect, test } from "../fixtures";

test("biblioteka innowacji: karta otwiera szczegóły", async ({ page }) => {
  await page.goto("/wiedza");
  const card = page.locator("#biblioteka .kb-card-button").first();
  const name = (await card.locator(".font-display").innerText()).trim();

  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("sekcje zasobnika mają treść z seeda", async ({ page }) => {
  await page.goto("/wiedza");
  await expect(page.locator("#wyzwania").getByRole("link", { name: /Raporty z badań/ })).toBeVisible();
  await expect(
    page.locator("#materialy").getByRole("link", { name: /Publikacje ze świata innowacji/ }),
  ).toBeVisible();
});
