import type { Page } from "@playwright/test";

import { action, expect, SAME_ORIGIN, statusWith, test, unique } from "../fixtures";

/**
 * Ścieżki zwykłego użytkownika (rola `user`, bez uprawnień admina ani mentora):
 * dodaje projekty, rozmawia z opiekunem, zgłasza się na testera i zostawia opinie.
 */

async function sendToCaretaker(page: Page, text: string) {
  const assistant = page.locator('[data-role="assistant"]');
  const input = page.locator("#chat-message-input");
  await expect(input).toBeEnabled();
  const before = await assistant.count();
  await input.fill(text);
  await page.getByRole("button", { name: "Wyślij wiadomość" }).click();
  await expect.poll(() => assistant.count()).toBeGreaterThan(before);
  await expect(input).toBeEnabled();
  return assistant.last();
}

/** Otwiera pierwsze rozwiązanie z listy testera i zwraca jego nazwę oraz okno. */
async function openFirstSolution(page: Page) {
  await page.goto("/tester");
  const card = page.locator("#rozwiazania .kb-card-button").first();
  const name = (await card.locator(".font-display").innerText()).trim();
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name, level: 2 })).toBeVisible();
  return { name, dialog };
}

async function approveMySignup(page: Page, adminApi: import("@playwright/test").APIRequestContext) {
  const { signups } = (await (await page.request.get("/api/testing/mine")).json()) as {
    signups: { id: string }[];
  };
  const decision = await adminApi.patch(`/api/admin/testing/signups/${signups[0].id}`, {
    headers: SAME_ORIGIN,
    data: { status: "approved" },
  });
  expect(decision.status()).toBe(200);
}

test.describe("zwykły użytkownik", { tag: "@smoke" }, () => {
  test("ma rolę user i nie ma dostępu do funkcji admina", async ({ userPage: page }) => {
    const me = (await (await page.request.get("/api/auth/me")).json()) as { role: string };
    expect(me.role).toBe("user");

    await page.goto("/app");
    await page.getByRole("button", { name: /^Menu konta/ }).click();
    await expect(page.getByRole("link", { name: "Profil" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Panel admina" })).toHaveCount(0);

    // Katalog innowacji uzupełnia tylko admin — opisy trafiają do promptu czatu
    const areas = (await (await page.request.get("/api/knowledge")).json()).areas as { id: string }[];
    const direct = await page.request.post("/api/actual-projects", {
      headers: SAME_ORIGIN,
      data: { name: "Projekt z pominięciem kolejki", description: "x", category_id: areas[0].id },
    });
    expect(direct.status()).toBe(403);
  });

  test("dodaje projekt: fiszka w kreatorze czeka na decyzję zespołu", async ({
    userPage: page,
    adminApi,
  }) => {
    const name = unique("Projekt użytkownika");
    await page.goto("/kreator");
    await page.getByLabel("Tytuł pomysłu").fill(name);
    await page.getByLabel("Krótki opis").fill("Sąsiedzka pomoc w dojazdach do lekarza.");
    await page.getByLabel("Co jest istotą pomysłu?").fill("Wolontariusze z samochodami i grafik dyżurów.");
    await page.getByLabel("Komu jest dedykowany?").fill("Seniorzy z małych miejscowości");
    await page.getByLabel("Etap realizacji").selectOption({ label: "Prototyp" });
    await page.getByLabel("Obszar").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Opublikuj fiszkę" }).click();
    await expect(statusWith(page, `Fiszka „${name}” została utworzona.`)).toBeVisible();

    const mine = page.getByRole("region", { name: "Twoje fiszki" });
    const card = mine.getByRole("listitem").filter({ hasText: name });
    await expect(card.getByText(/Status:/)).toBeVisible();
    await expect(card.getByRole("button", { name: action("Edytuj", name) })).toBeVisible();

    // Projekt trafił do kolejki admina jako oczekujący
    const queue = (await (await adminApi.get("/api/admin/ideas")).json()) as {
      name: string;
      status: string;
    }[];
    expect(queue.find((idea) => idea.name === name)?.status).toBe("pending");
  });

  test("dodaje projekt: propozycja z rozmowy, gdy w bazie nie ma rozwiązania", async ({
    userPage: page,
    user,
    adminApi,
  }) => {
    const name = unique("Propozycja z czatu");
    await page.goto("/app");
    await sendToCaretaker(page, "Potrzebujemy wypożyczalni wózków w gminie [e2e:no-match]");

    const offer = page.getByRole("group", { name: "Nowy projekt" });
    await offer.getByRole("button", { name: "Zgłoś nowy projekt" }).click();

    const dialog = page.getByRole("dialog");
    // Szkic z rozmowy jest wstawiony — użytkownik go poprawia przed wysłaniem
    await expect(dialog.getByLabel("Nazwa")).not.toHaveValue("");
    await dialog.getByLabel("Nazwa").fill(name);
    await dialog.getByLabel("Opis potrzeby").fill("Brakuje wypożyczalni wózków inwalidzkich w gminie.");
    await dialog.getByRole("button", { name: "Wyślij propozycję" }).click();

    await expect(dialog).toBeHidden();
    await expect(statusWith(page, name)).toContainText("Propozycja dla zespołu");
    await expect(offer).toHaveCount(0);

    const proposals = (await (await adminApi.get("/api/admin/project-proposals")).json()) as {
      name: string;
      author_email: string;
      status: string;
    }[];
    const sent = proposals.find((proposal) => proposal.name === name);
    expect(sent?.author_email).toBe(user.email);
    expect(sent?.status).toBe("nowe");
  });

  test("pisze z opiekunem: dopytanie, a potem dopasowany projekt", async ({ userPage: page }) => {
    await page.goto("/app");

    const first = await sendToCaretaker(page, "Dzień dobry, potrzebuję pomocy");
    await expect(first).toContainText("Kogo dotyczy sprawa");

    const second = await sendToCaretaker(page, "Chodzi o samotnych seniorów [e2e:match]");
    await expect(second).not.toContainText("[[hubmi");
    const suggestion = page.getByLabel("Sugerowane projekty").getByRole("button").first();
    await expect(suggestion).toBeVisible();

    // Cała rozmowa zostaje na ekranie
    await expect(page.locator('[data-role="user"]')).toHaveCount(2);
    await expect(page.locator('[data-role="user"]').first()).toContainText("Dzień dobry");

    await suggestion.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("zgłasza się na testera i widzi status zgłoszenia", async ({ userPage: page }) => {
    const { name, dialog } = await openFirstSolution(page);

    await dialog.getByLabel(/Dlaczego chcesz testować/).fill("Prowadzę świetlicę wiejską.");
    await dialog.getByRole("button", { name: "Chcę testować" }).click();
    await expect(statusWith(page, `Zgłoszono chęć testowania: „${name}”.`)).toBeVisible();
    await expect(dialog.getByText("Czeka na decyzję")).toBeVisible();
    await page.keyboard.press("Escape");

    const mine = page.getByRole("region", { name: "Moje testy i opinie" });
    await expect(mine.getByRole("button", { name })).toBeVisible();
    await expect(mine.getByText("Czeka na decyzję")).toBeVisible();
    await expect(
      page.locator("#rozwiazania .kb-card-button").first().getByText("Zgłoszono do testów"),
    ).toBeVisible();

    // Zgłoszenie przeżywa przeładowanie
    await page.reload();
    await expect(mine.getByText("Czeka na decyzję")).toBeVisible();
  });

  test("bez przyjętego zgłoszenia nie może wystawić opinii", async ({ userPage: page }) => {
    const { dialog } = await openFirstSolution(page);
    await dialog.getByRole("button", { name: "Chcę testować" }).click();
    await expect(dialog.getByText("Czeka na decyzję")).toBeVisible();

    await expect(dialog.getByText(/Opinię mogą dodać tylko testerzy/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Wyślij opinię" })).toHaveCount(0);

    // API pilnuje tego samego — sam formularz to nie zabezpieczenie
    const solutions = (await (await page.request.get("/api/testing/solutions")).json()) as {
      kind: string;
      id: string;
    }[];
    const forced = await page.request.put(
      `/api/testing/solutions/${solutions[0].kind}/${solutions[0].id}/review`,
      { headers: SAME_ORIGIN, data: { rating: 5, feedback: "Bez testów", improvement: "" } },
    );
    expect(forced.status()).toBe(403);
  });

  test("po przyjęciu do testów zostawia opinię, poprawia ją i usuwa", async ({
    userPage: page,
    user,
    adminApi,
  }) => {
    const { name, dialog } = await openFirstSolution(page);
    await dialog.getByRole("button", { name: "Chcę testować" }).click();
    await expect(dialog.getByText("Czeka na decyzję")).toBeVisible();
    await approveMySignup(page, adminApi);

    await page.reload();
    const mine = page.getByRole("region", { name: "Moje testy i opinie" });
    await expect(mine.getByText("Przyjęto do testów")).toBeVisible();
    await mine.getByRole("button", { name }).click();

    const feedback = unique("Sprawdziło się w grupie 10 osób");
    await dialog.locator("label.rating-option").filter({ hasText: "4" }).click();
    await dialog.getByLabel(/Informacja zwrotna/).fill(feedback);
    await dialog.getByLabel(/Propozycja usprawnień/).fill("Krótsza instrukcja dla prowadzących.");
    await dialog.getByRole("button", { name: "Wyślij opinię" }).click();
    await expect(statusWith(page, "Dziękujemy za opinię.")).toBeVisible();

    // Opinia jest na publicznej liście pod rozwiązaniem, podpisana autorem
    const published = dialog.getByRole("listitem").filter({ hasText: feedback });
    await expect(published).toContainText("4 / 5");
    await expect(published).toContainText(user.name);
    await expect(published).toContainText("Krótsza instrukcja dla prowadzących.");

    // Druga wysyłka poprawia tę samą opinię zamiast dodawać kolejną
    await dialog.locator("label.rating-option").filter({ hasText: "5" }).click();
    await dialog.getByRole("button", { name: "Zapisz zmiany" }).click();
    await expect(statusWith(page, "Zaktualizowano Twoją opinię.")).toBeVisible();
    await expect(published).toContainText("5 / 5");
    await expect(dialog.getByRole("listitem").filter({ hasText: feedback })).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(mine.getByText("5 / 5")).toBeVisible();
    await expect(
      page.locator("#rozwiazania .kb-card-button").first().getByText("Twoja opinia"),
    ).toBeVisible();

    await mine.getByRole("button", { name }).last().click();
    page.once("dialog", (confirm) => void confirm.accept());
    await dialog.getByRole("button", { name: "Usuń opinię" }).click();
    await expect(statusWith(page, "Usunięto opinię.")).toBeVisible();
    await expect(dialog.getByRole("listitem").filter({ hasText: feedback })).toHaveCount(0);
  });
});
