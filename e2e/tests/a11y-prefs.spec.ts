import { expect, test } from "../fixtures";

test.describe("menu dostępności", () => {
  test("zmienia wielkość tekstu i wysoki kontrast", async ({ page }) => {
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Ustawienia dostępności" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    await expect(page.getByText("Wielkość tekstu")).toBeVisible();

    await page.getByRole("button", { name: "Duży" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");

    await page.getByLabel("Wysoki kontrast").check();
    await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");

    // Preferencje przeżywają przeładowanie
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
    await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");

    await page.getByRole("button", { name: "Ustawienia dostępności" }).click();
    await page.getByRole("button", { name: "Przywróć domyślne" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "medium");
    await expect(page.locator("html")).not.toHaveAttribute("data-high-contrast");
  });
});
