import type { Page } from "@playwright/test";

import { ADMIN } from "../env";
import { alertWith, expect, SAME_ORIGIN, test } from "../fixtures";

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Hasło").fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
}

test("rejestracja, a potem logowanie prowadzi do /app", async ({ page }) => {
  const email = `ui-${Date.now()}-${test.info().workerIndex}@e2e-malohub.dev`;
  await page.goto("/register");
  await page.getByLabel("Imię").fill("Jan");
  await page.getByLabel("Nazwisko").fill("Kowalski");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Hasło").fill("bardzo-tajne-haslo");
  await page.getByRole("button", { name: "Załóż konto" }).click();

  await expect(page).toHaveURL(/\/login\?registered=1/);
  await fillLogin(page, email, "bardzo-tajne-haslo");

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Witaj, Jan Kowalski" })).toBeVisible();
});

test("rejestracja na zajęty email pokazuje błąd", async ({ page, user }) => {
  await page.goto("/register");
  await page.getByLabel("Imię").fill("Jan");
  await page.getByLabel("Nazwisko").fill("Kowalski");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Hasło").fill("bardzo-tajne-haslo");
  await page.getByRole("button", { name: "Załóż konto" }).click();

  await expect(alertWith(page, "Konto z tym adresem email już istnieje")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("złe hasło pokazuje błąd i nie loguje", async ({ page, user }) => {
  await page.goto("/login");
  await fillLogin(page, user.email, "zupelnie-inne-haslo");

  await expect(alertWith(page, "Nieprawidłowy email lub hasło")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("email przy logowaniu nie rozróżnia wielkości liter", async ({ page, user }) => {
  await page.goto("/login");
  await fillLogin(page, user.email.toUpperCase(), user.password);
  await expect(page).toHaveURL(/\/app$/);
});

test("admin po zalogowaniu trafia do panelu", async ({ page }) => {
  await page.goto("/login");
  await fillLogin(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
});

test("sesja przeżywa nawigację między stronami i przeładowanie", async ({ userPage: page, user }) => {
  const accountMenu = page.getByRole("button", { name: `Menu konta: ${user.name} ${user.surname}` });

  await page.goto("/app");
  await expect(accountMenu).toBeVisible();

  // Nawigacja po stronie klienta (linki w nagłówku)
  for (const [label, url] of [
    ["Zasobnik wiedzy", /\/wiedza$/],
    ["Kreator pomysłów", /\/kreator$/],
    ["Tester innowacji", /\/tester$/],
    ["Kontakt", /\/kontakt$/],
  ] as const) {
    await page.getByRole("banner").getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(url);
    await expect(accountMenu).toBeVisible();
  }

  // Pełne przeładowanie i wejście z adresu — sesję odtwarza SSR z cookie
  await page.reload();
  await expect(page).toHaveURL(/\/kontakt$/);
  await expect(accountMenu).toBeVisible();

  for (const path of ["/profil", "/kreator", "/app"]) {
    await page.goto(path);
    await expect(accountMenu).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("wylogowanie kończy sesję", async ({ userPage: page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /^Menu konta/ }).click();
  await page.getByRole("button", { name: "Wyloguj się" }).click();

  await expect(page).toHaveURL(/\/$/);
  // Wylogowanie w UI nie czeka na BFF — cookie znika chwilę po przekierowaniu
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((c) => c.name === "hubmi_session" && c.value),
    )
    .toBe(false);

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("ochrona tras", () => {
  for (const path of ["/app", "/profil", "/admin", "/admin/users"]) {
    test(`anonim na ${path} trafia na /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("zwykły użytkownik na /admin wraca do /app", async ({ userPage: page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("rejestracja nie pozwala nadać sobie roli admina", async ({ request }) => {
    const res = await request.post("/api/auth/register", {
      headers: SAME_ORIGIN,
      data: {
        email: `role-${Date.now()}@e2e-malohub.dev`,
        password: "bardzo-tajne-haslo",
        name: "Ewa",
        surname: "Eskalacja",
        role: "admin",
      },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).role).toBe("user");
  });
});

test("wygaśnięcie sesji przy otwartej karcie wylogowuje zamiast pokazywać błąd 401", async ({
  userPage: page,
}) => {
  await page.goto("/app");
  await expect(page.getByRole("button", { name: /^Menu konta/ })).toBeVisible();

  // Cookie znika razem z `exp` JWT, a AuthProvider wciąż trzyma usera z pierwszego ładowania
  await page.context().clearCookies({ name: "hubmi_session" });
  await page.getByRole("banner").getByRole("link", { name: "Tester innowacji" }).click();

  await expect(page).toHaveURL(/\/tester$/);
  await expect(page.getByRole("banner").getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  await expect(page.getByText("Not authenticated")).toHaveCount(0);
});
