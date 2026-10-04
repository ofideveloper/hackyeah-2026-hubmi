import { expect, test } from "../fixtures";

test.describe("aplikacja wstaje", { tag: "@smoke" }, () => {
  test("landing renderuje się i prowadzi do logowania", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MaloHUB/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zaloguj się" }).first()).toBeVisible();
  });

  test("BFF przekazuje żądania do API", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "healthy" });
  });

  test("zasobnik wiedzy pokazuje dane z seeda bez logowania", async ({ page }) => {
    await page.goto("/wiedza");
    const library = page.locator("#biblioteka");
    await expect(library.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(page.locator("#materialy").getByRole("link").first()).toBeVisible();
  });
});
