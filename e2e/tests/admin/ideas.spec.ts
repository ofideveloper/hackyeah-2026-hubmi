import { action, createIdea, expect, test, unique } from "../../fixtures";

test("decyzja admina o fiszce wraca do autora ze statusem, komentarzem i wiadomością", async ({
  userPage: page,
  adminPage,
}) => {
  const name = unique("Klub sąsiedzki");
  await createIdea(page.request, name);

  await adminPage.goto("/admin/ideas");
  const card = adminPage.getByRole("listitem").filter({ hasText: name });
  await card.getByLabel(/Komentarz dla autora/).fill("Świetny pomysł, zapraszamy do naboru.");
  await card.getByRole("button", { name: action("Zatwierdź", name) }).click();
  await expect(card.getByRole("button", { name: action("Zatwierdź", name) })).toHaveCount(0);

  await page.goto("/kreator");
  const mine = page.getByRole("region", { name: "Twoje fiszki" });
  const idea = mine.getByRole("listitem").filter({ hasText: name });
  await expect(idea.getByText("Świetny pomysł, zapraszamy do naboru.")).toBeVisible();
  await expect(idea.getByText(/Status:/)).not.toContainText(/oczekuje|czeka/i);

  await page.goto("/kontakt");
  await expect(page.getByRole("button", { name: new RegExp(`Fiszka: ${name}`) })).toBeVisible();
});
