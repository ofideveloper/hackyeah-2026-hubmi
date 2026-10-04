import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { createIdea, expect, login, SAME_ORIGIN, test, unique } from "../fixtures";

/** Reguła zespołu: WCAG 2.1 AA (docs/team/accessibility.md). */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Świadome wyjątki czekające na decyzję projektową — każde nowe naruszenie wywali test.
 * Wpis: `(rule, target) => …` z komentarzem; usuń go po naprawie, żeby regresja znów była łapana.
 */
const KNOWN_ISSUES: ((rule: string, target: string) => boolean)[] = [];

async function expectNoViolations(page: Page) {
  // Wejściowe animacje (`animate-fade-up`) zaniżają kontrast w trakcie przejścia
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter(
        (node) => !KNOWN_ISSUES.some((known) => known(violation.id, node.target.join(" "))),
      ),
    }))
    .filter((violation) => violation.nodes.length > 0)
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(" | ")}`,
    );
  expect(summary).toEqual([]);
}

test.describe("dostępność — strony publiczne", () => {
  for (const path of ["/", "/login", "/register", "/wiedza", "/kreator", "/tester", "/kontakt"]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expectNoViolations(page);
    });
  }
});

test.describe("dostępność — po zalogowaniu", () => {
  for (const path of ["/app", "/profil", "/kreator", "/tester", "/kontakt"]) {
    test(path, async ({ userPage: page }) => {
      await page.goto(path);
      await expectNoViolations(page);
    });
  }
});

test.describe("dostępność — panel admina", () => {
  for (const path of ["/admin", "/admin/users", "/admin/knowledge", "/admin/grants"]) {
    test(path, async ({ adminPage: page }) => {
      await page.goto(path);
      await expectNoViolations(page);
    });
  }

  test("/admin/ideas z fiszkami w każdym statusie", async ({
    adminPage: page,
    adminApi,
    request,
    user,
  }) => {
    // Lista zależy od danych — bez fiszek etykiety statusów w ogóle się nie renderują
    await login(request, user);
    for (const status of ["pending", "approved", "rejected"]) {
      const idea = await createIdea(request, unique(`Fiszka ${status}`));
      if (status === "pending") continue;
      const decision = await adminApi.patch(`/api/admin/ideas/${idea.id}`, {
        headers: SAME_ORIGIN,
        data: { status },
      });
      expect(decision.status()).toBe(200);
    }
    await page.goto("/admin/ideas");
    await expect(page.getByRole("button", { name: /^Zatwierdź/ }).first()).toBeVisible();
    await expectNoViolations(page);
  });
});
