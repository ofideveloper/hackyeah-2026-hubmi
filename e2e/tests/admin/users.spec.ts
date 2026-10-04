import { action, expect, test } from "../../fixtures";

test("admin nadaje rolę mentora — użytkownik pojawia się na liście mentorów", async ({
  adminPage: page,
  user,
  request,
}) => {
  await page.goto("/admin/users");
  const row = page.getByRole("row").filter({ hasText: user.email });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: action("Nadaj rolę mentora", user.email) }).click();
  await expect(row.getByRole("button", { name: action("Odbierz rolę mentora", user.email) })).toBeVisible();

  const mentors = (await (await request.get("/api/mentors")).json()) as { id: string }[];
  expect(mentors.map((mentor) => mentor.id)).toContain(user.id);
});
