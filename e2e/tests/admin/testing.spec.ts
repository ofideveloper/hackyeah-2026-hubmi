import { expect, SAME_ORIGIN, test, unique } from "../../fixtures";

test("admin przyjmuje zgłoszenie testera w panelu", async ({ userPage, adminPage: page }) => {
  const motivation = unique("Testuję w świetlicy");
  const solutions = (await (await userPage.request.get("/api/testing/solutions")).json()) as {
    kind: string;
    id: string;
    name: string;
  }[];
  const target = solutions[0];
  const signup = await userPage.request.post(
    `/api/testing/solutions/${target.kind}/${target.id}/signups`,
    { headers: SAME_ORIGIN, data: { motivation } },
  );
  expect(signup.status(), await signup.text()).toBe(201);

  await page.goto("/admin/testing");
  const item = page.getByRole("listitem").filter({ hasText: motivation });
  await item.getByRole("button", { name: /^Przyjmij/ }).click();
  await expect(item.getByRole("button", { name: /^Przyjmij/ })).toHaveCount(0);

  const mine = (await (await userPage.request.get("/api/testing/mine")).json()) as {
    signups: { status: string }[];
  };
  expect(mine.signups[0].status).toBe("approved");
});
