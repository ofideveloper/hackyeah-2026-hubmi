import { action, expect, test, unique } from "../../fixtures";

test("zasób dodany przez admina jest widoczny w zasobniku i znika po usunięciu", async ({
  adminPage: page,
  browser,
}) => {
  const title = unique("Poradnik E2E");
  await page.goto("/admin/knowledge");

  await page.getByLabel("Sekcja").selectOption("material");
  await page.getByLabel("Tytuł").fill(title);
  await page.getByLabel("Forma").fill("Poradnik");
  await page.getByLabel(/Adres|Link|URL/i).fill("https://example.org/poradnik");
  await page.getByRole("button", { name: "Dodaj zasób" }).click();
  await expect(page.getByText(/Dodano zasób/)).toBeVisible();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/wiedza");
  await expect(guest.locator("#materialy").getByRole("link", { name: new RegExp(title) })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: action("Usuń", title) }).click();
  await expect(page.getByRole("button", { name: action("Usuń", title) })).toHaveCount(0);

  await guest.reload();
  await expect(guest.locator("#materialy").getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
  await guest.context().close();
});
