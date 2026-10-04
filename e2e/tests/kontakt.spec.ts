import { expect, login, registerUser, SAME_ORIGIN, statusWith, test, unique } from "../fixtures";

test("pytanie do ROPS trafia do admina, a odpowiedź wraca do użytkownika", async ({
  userPage: page,
  adminPage,
}) => {
  const subject = unique("Pytanie o nabór");
  await page.goto("/kontakt");
  await page.getByRole("button", { name: "Zadaj pytanie ROPS" }).click();

  const compose = page.getByRole("dialog");
  await compose.getByLabel("Temat").fill(subject);
  await compose.locator("textarea").fill("Czy stowarzyszenie może złożyć wniosek?");
  await compose.locator('button[type="submit"]').click();

  await expect(statusWith(page, /Wiadomość wysłana/)).toBeVisible();
  const thread = page.getByRole("log", { name: `Wiadomości w rozmowie: ${subject}` });
  await expect(thread.getByText("Czy stowarzyszenie może złożyć wniosek?")).toBeVisible();

  await adminPage.goto("/admin/messages");
  await adminPage.getByRole("button", { name: new RegExp(subject) }).click();
  const adminThread = adminPage.getByRole("log", { name: `Wiadomości w rozmowie: ${subject}` });
  await expect(adminThread.getByText("Czy stowarzyszenie może złożyć wniosek?")).toBeVisible();
  await adminPage.getByPlaceholder("Napisz wiadomość…").fill("Tak, nabór jest otwarty dla NGO.");
  await adminPage.getByRole("button", { name: "Wyślij wiadomość" }).click();
  await expect(adminThread.getByText("Tak, nabór jest otwarty dla NGO.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: new RegExp(subject) }).click();
  await expect(thread.getByText("Tak, nabór jest otwarty dla NGO.")).toBeVisible();
});

test("rozmowy jednego użytkownika nie są widoczne dla innego", async ({ userPage: page, browser }) => {
  const subject = unique("Prywatna sprawa");
  const created = await page.request.post("/api/conversations", {
    headers: SAME_ORIGIN,
    data: { kind: "pytanie", subject, body: "Treść tylko dla ROPS" },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const other = await browser.newContext();
  await login(other.request, await registerUser(other.request));
  expect((await other.request.get(`/api/conversations/${id}`)).status()).toBe(404);
  const list = (await (await other.request.get("/api/conversations")).json()) as { id: string }[];
  expect(list.map((item) => item.id)).not.toContain(id);
  await other.close();
});
