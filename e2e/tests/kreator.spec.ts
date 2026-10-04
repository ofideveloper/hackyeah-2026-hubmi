import { action, expect, statusWith, test, unique } from "../fixtures";

test("anonim widzi zachętę do logowania zamiast formularza", async ({ page }) => {
  await page.goto("/kreator");
  const section = page.locator("#fiszka");
  await expect(section.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  await expect(section.getByLabel("Tytuł pomysłu")).toHaveCount(0);
});

test("fiszka: utworzenie, edycja i usunięcie", async ({ userPage: page }) => {
  const name = unique("Sąsiedzka wypożyczalnia");
  await page.goto("/kreator");

  await page.getByLabel("Tytuł pomysłu").fill(name);
  await page.getByLabel("Krótki opis").fill("Wspólny sprzęt rehabilitacyjny dla mieszkańców gminy.");
  await page.getByLabel("Komu jest dedykowany?").fill("Seniorzy i ich opiekunowie");
  await page.getByLabel("Obszar").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Zgłoś pomysł" }).click();

  await expect(
    statusWith(
      page,
      `Pomysł „${name}” został zgłoszony i czeka na ocenę zespołu ROPS.`,
    ),
  ).toBeVisible();

  // Po zapisie otwiera się dialog ze szczegółami
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name })).toBeVisible();
  await expect(dialog.getByText("Seniorzy i ich opiekunowie")).toBeVisible();
  await dialog.getByRole("button", { name: "Zamknij" }).first().click();

  const mine = page.getByRole("region", { name: "Twoje pomysły" });
  await expect(mine.getByRole("heading", { name })).toBeVisible();

  // Dane są w bazie, nie tylko w stanie strony
  await page.reload();
  await expect(mine.getByRole("heading", { name })).toBeVisible();

  await mine.getByRole("button", { name: action("Edytuj", name) }).click();
  await expect(page.getByLabel("Tytuł pomysłu")).toHaveValue(name);
  await page.getByLabel("Krótki opis").fill("Opis po zmianie.");
  await page.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(statusWith(page, "Zapisano zmiany w pomyśle.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Zamknij" }).first().click();
  await expect(mine.getByText("Opis po zmianie.")).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await mine.getByRole("button", { name: action("Usuń", name) }).click();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
});

test("asystent kreatora odpowiada i wstawia tekst do fiszki", async ({ userPage: page }) => {
  await page.goto("/kreator");
  await page.getByLabel("Tytuł pomysłu").fill("Mobilny punkt porad");
  await page.getByLabel("Krótki opis").fill("Porady prawne i socjalne w małych miejscowościach.");

  await page.getByRole("radio", { name: "Zapytaj asystenta" }).click();
  await page.getByLabel("Twoje pytanie").fill("Jak dotrzeć do seniorów na wsi?");
  await page.getByRole("button", { name: "Zapytaj" }).click();

  const insert = page.getByRole("button", { name: "Wstaw do pola „Istota pomysłu”" });
  await expect(insert).toBeVisible();
  await insert.click();
  await expect(page.getByLabel("Co jest istotą pomysłu?")).not.toHaveValue("");
});
