import { expect, test, unique } from "../../fixtures";

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

test("nabór z panelu admina pojawia się w kreatorze, a użytkownik składa wniosek", async ({
  adminPage,
  userPage: page,
}) => {
  const title = unique("Nabór E2E");
  await adminPage.goto("/admin/grants");
  await adminPage.getByLabel("Nazwa naboru").fill(title);
  await adminPage.getByLabel("Początek naboru").fill(isoDay(-1));
  await adminPage.getByLabel("Koniec naboru (włącznie)").fill(isoDay(7));
  await adminPage.getByLabel("Pytanie 1", { exact: true }).fill("Cel projektu");
  await adminPage.getByRole("button", { name: "Dodaj nabór" }).click();
  await expect(adminPage.getByText("Dodano nabór.")).toBeVisible();

  await page.goto("/kreator");
  const calls = page.getByRole("region", { name: "Trwające nabory" });
  const call = calls.getByRole("article").filter({ hasText: title });
  await expect(call).toBeVisible();

  await call.getByLabel("Cel projektu").fill("Wsparcie opiekunów nieformalnych.");
  await call.getByRole("button", { name: "Zapisz szkic" }).click();
  await page.reload();
  await expect(call.getByLabel("Cel projektu")).toHaveValue("Wsparcie opiekunów nieformalnych.");
});
