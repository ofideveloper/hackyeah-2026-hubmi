import { BASE_URL } from "../env";
import { alertWith, expect, SAME_ORIGIN, statusWith, test } from "../fixtures";

test("profil pokazuje dane konta", async ({ userPage: page, user }) => {
  await page.goto("/profil");
  const account = page.getByRole("region", { name: "Dane konta" });
  await expect(account.getByText(`${user.name} ${user.surname}`)).toBeVisible();
  await expect(account.getByText(user.email)).toBeVisible();
});

test("zmiana hasła: stare przestaje działać, nowe loguje", async ({ userPage: page, user, playwright }) => {
  const newPassword = "nowe-lepsze-haslo";
  await page.goto("/profil");
  await page.getByLabel("Obecne hasło").fill(user.password);
  await page.getByLabel("Nowe hasło", { exact: true }).fill(newPassword);
  await page.getByLabel("Powtórz nowe hasło").fill(newPassword);
  await page.getByRole("button", { name: "Zmień hasło" }).click();
  await expect(statusWith(page, "Hasło zostało zmienione")).toBeVisible();

  const fresh = await playwright.request.newContext({ baseURL: BASE_URL });
  const attempt = (password: string) =>
    fresh.post("/api/auth/login", {
      headers: SAME_ORIGIN,
      form: { username: user.email, password },
    });
  expect((await attempt(user.password)).status()).toBe(400);
  expect((await attempt(newPassword)).status()).toBe(200);
  await fresh.dispose();
});

test("zmiana hasła wymaga poprawnego obecnego hasła i zgodnego powtórzenia", async ({
  userPage: page,
  user,
}) => {
  await page.goto("/profil");
  await page.getByLabel("Obecne hasło").fill(user.password);
  await page.getByLabel("Nowe hasło", { exact: true }).fill("nowe-lepsze-haslo");
  await page.getByLabel("Powtórz nowe hasło").fill("zupelnie-inne-haslo");
  await page.getByRole("button", { name: "Zmień hasło" }).click();
  await expect(alertWith(page, "Nowe hasła nie są takie same")).toBeVisible();

  await page.getByLabel("Obecne hasło").fill("nie-to-haslo-123");
  await page.getByLabel("Powtórz nowe hasło").fill("nowe-lepsze-haslo");
  await page.getByRole("button", { name: "Zmień hasło" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toBeVisible();
  await expect(statusWith(page, "Hasło zostało zmienione")).toHaveCount(0);
});
