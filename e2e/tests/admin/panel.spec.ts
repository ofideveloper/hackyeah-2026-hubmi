import { expect, test } from "../../fixtures";

const SECTIONS: [label: string, path: string][] = [
  ["Katalog innowacji", "/admin/catalog"],
  ["Middleman Innowacji", "/admin/middleman"],
  ["Propozycje", "/admin/proposals"],
  ["Zasobnik wiedzy", "/admin/knowledge"],
  ["Fiszki pomysłów", "/admin/ideas"],
  ["Nabory grantowe", "/admin/grants"],
  ["Zgłoszenia testerów", "/admin/testing"],
  ["Wiadomości", "/admin/messages"],
  ["Trendy potrzeb", "/admin/trends"],
  ["Użytkownicy", "/admin/users"],
  ["Przegląd", "/admin"],
];

test("admin przechodzi po wszystkich sekcjach panelu bez utraty sesji", async ({ adminPage: page }) => {
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Sekcje panelu" });

  for (const [label, path] of SECTIONS) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Błąd pobierania danych sekcji pokazałby się jako alert w treści strony
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  }
});

test("sekcja panelu otwarta z adresu działa po przeładowaniu", async ({ adminPage: page }) => {
  await page.goto("/admin/users");
  await expect(page.getByRole("table", { name: "Użytkownicy" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("table", { name: "Użytkownicy" })).toBeVisible();
});
