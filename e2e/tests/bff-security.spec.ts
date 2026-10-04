import { BASE_URL } from "../env";
import { expect, login, SAME_ORIGIN, test } from "../fixtures";

test("logowanie nie zwraca JWT — token trafia tylko do cookie HttpOnly", async ({ request, user }) => {
  const res = await request.post("/api/auth/login", {
    headers: SAME_ORIGIN,
    form: { username: user.email, password: user.password },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });

  const cookies = (await request.storageState()).cookies;
  const session = cookies.find((c) => c.name === "hubmi_session");
  const hint = cookies.find((c) => c.name === "hubmi_auth");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  // Znacznik dla JS nie niesie tokena
  expect(hint?.httpOnly).toBe(false);
  expect(hint?.value).toBe("1");
});

test("JS w przeglądarce nie widzi tokena sesji", async ({ userPage: page }) => {
  await page.goto("/app");
  await expect(page.getByRole("button", { name: /^Menu konta/ })).toBeVisible();
  const visible = await page.evaluate(() => document.cookie);
  expect(visible).not.toContain("hubmi_session");
  expect(await page.evaluate(() => localStorage.getItem("hubmi_token"))).toBeNull();
});

test.describe("CSRF", () => {
  test("POST z obcego originu jest odrzucany", async ({ request, user }) => {
    const res = await request.post("/api/auth/login", {
      headers: { Origin: "https://evil.example" },
      form: { username: user.email, password: user.password },
    });
    expect(res.status()).toBe(403);
  });

  test("POST bez originu jest odrzucany", async ({ request, user }) => {
    const res = await request.post("/api/auth/login", {
      form: { username: user.email, password: user.password },
    });
    expect(res.status()).toBe(403);
  });

  test("mutacja przez proxy z obcego originu jest odrzucana mimo ważnej sesji", async ({
    request,
    user,
  }) => {
    await login(request, user);
    const res = await request.patch("/api/users/me", {
      headers: { Origin: "https://evil.example" },
      data: { name: "Przejęte" },
    });
    expect(res.status()).toBe(403);

    const me = await request.get("/api/auth/me");
    expect((await me.json()).name).toBe(user.name);
  });
});

test("nagłówek Authorization z przeglądarki jest ignorowany", async ({ request, user, playwright }) => {
  await login(request, user);
  const token = (await request.storageState()).cookies.find((c) => c.name === "hubmi_session")!.value;

  const anonymous = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await anonymous.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
  });
  expect(res.status()).toBe(401);
  await anonymous.dispose();
});

test.describe("autoryzacja endpointów admina", () => {
  const adminPaths = [
    "/api/admin/stats",
    "/api/admin/users",
    "/api/admin/ideas",
    "/api/admin/testing/signups",
    "/api/admin/trends",
  ];

  for (const path of adminPaths) {
    test(`${path}: anonim 401, zwykły użytkownik 403`, async ({ request, user }) => {
      expect((await request.get(path)).status()).toBe(401);
      await login(request, user);
      expect((await request.get(path)).status()).toBe(403);
    });
  }
});

test("proxy nie wypuszcza żądań poza API", async ({ request }) => {
  const res = await request.get("/api/%2F%2Fevil.example/steal");
  expect(res.status()).toBeGreaterThanOrEqual(400);
});
