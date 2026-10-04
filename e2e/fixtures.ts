import { randomUUID } from "node:crypto";

import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

import { ADMIN, BASE_URL } from "./env";

export type Credentials = { email: string; password: string };
export type TestUser = Credentials & { id: string; name: string; surname: string };

/**
 * BFF odrzuca mutacje bez potwierdzenia originu (`isSameOriginRequest`). Przeglądarka
 * wysyła `Sec-Fetch-Site` sama; żądania z `APIRequestContext` muszą podać `Origin`.
 */
export const SAME_ORIGIN = { Origin: BASE_URL };

export async function registerUser(
  request: APIRequestContext,
  overrides: Partial<Omit<TestUser, "id">> = {},
): Promise<TestUser> {
  const user = {
    email: `user-${randomUUID()}@e2e-malohub.dev`,
    password: "e2e-user-password",
    name: "Tosia",
    surname: "Testowa",
    ...overrides,
  };
  const res = await request.post("/api/auth/register", {
    headers: SAME_ORIGIN,
    data: { ...user, phone_number: null },
  });
  expect(res.status(), await res.text()).toBe(201);
  const { id } = (await res.json()) as { id: string };
  return { ...user, id };
}

/** Logowanie przez BFF — cookie sesji ląduje w kontekście, do którego należy `request`. */
export async function login(request: APIRequestContext, creds: Credentials): Promise<void> {
  const res = await request.post("/api/auth/login", {
    headers: SAME_ORIGIN,
    form: { username: creds.email, password: creds.password },
  });
  expect(res.status(), await res.text()).toBe(200);
}

/** Nagłówek Next-a też ma `role="alert"` (route announcer) — szukaj komunikatu po treści. */
export function alertWith(page: Page, text: string | RegExp) {
  return page.getByRole("alert").filter({ hasText: text });
}

type Fixtures = {
  /** Świeże konto na test — testy mutujące dane nie dzielą stanu. */
  user: TestUser;
  /** `page` z zalogowanym świeżym użytkownikiem. */
  userPage: Page;
  /** `page` z zalogowanym adminem z seeda (osobny kontekst — można łączyć z `userPage`). */
  adminPage: Page;
  /** Klient BFF z sesją admina — przygotowanie danych bez klikania po panelu. */
  adminApi: APIRequestContext;
};

export const test = base.extend<Fixtures>({
  user: async ({ request }, use) => {
    await use(await registerUser(request));
  },
  userPage: async ({ page, user }, use) => {
    await login(page.request, user);
    await use(page);
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    await login(context.request, ADMIN);
    await use(await context.newPage());
    await context.close();
  },
  adminApi: async ({ playwright }, use) => {
    const api = await playwright.request.newContext({ baseURL: BASE_URL });
    await login(api, ADMIN);
    await use(api);
    await api.dispose();
  },
});

/**
 * Nazwa przycisku akcji z celem dla czytników: „Usuń<span class="sr-only">: Tytuł</span>”
 * daje nazwę „Usuń : Tytuł” — odstępy zależą od przeglądarki, stąd wyrażenie.
 */
export function action(verb: string, target: string): RegExp {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${verb}\\s*:\\s*${escaped}$`);
}

/** Unikalna nazwa — testy lecą równolegle na jednej bazie. */
export function unique(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

/** Komunikat potwierdzenia (`Toast`) albo inny tekst w żywym regionie. */
export function statusWith(page: Page, text: string | RegExp) {
  return page.getByRole("status").filter({ hasText: text });
}

/** Fiszka założona przez API w imieniu właściciela `request`. */
export async function createIdea(request: APIRequestContext, name: string) {
  const knowledge = await request.get("/api/knowledge");
  const { areas } = (await knowledge.json()) as { areas: { id: string }[] };
  const res = await request.post("/api/ideas", {
    headers: SAME_ORIGIN,
    data: { name, description: "Opis pomysłu z testu E2E", category_id: areas[0].id },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string; name: string };
}

export { expect };
