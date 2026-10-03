import type { IdeaStatus, TestSolution, TestTargetKind } from "@/lib/api";

export const KIND_LABEL: Record<TestTargetKind, string> = {
  innowacja: "Innowacja z biblioteki",
  pomysl: "Pomysł z Kreatora",
};

export const SIGNUP_STATUS: Record<IdeaStatus, { label: string; className: string }> = {
  pending: { label: "Czeka na decyzję", className: "status-pill status-pill-new" },
  approved: { label: "Przyjęto do testów", className: "status-pill status-pill-done" },
  rejected: { label: "Nie przyjęto", className: "status-pill status-pill-rejected" },
};

export const RATINGS = [1, 2, 3, 4, 5] as const;

export function targetKey(target: { kind: TestTargetKind; id: string }): string {
  return `${target.kind}:${target.id}`;
}

function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100;
  const units = count % 10;
  if (count === 1) return one;
  if (units >= 2 && units <= 4 && (tens < 12 || tens > 14)) return few;
  return many;
}

export function reviewsLabel(count: number): string {
  return `${count} ${plural(count, "opinia", "opinie", "opinii")}`;
}

export function testersLabel(count: number): string {
  return `${count} ${plural(count, "tester", "testerów", "testerów")}`;
}

/** „4,5 / 5 · 3 opinie” albo „Brak ocen”. */
export function ratingLabel(solution: Pick<TestSolution, "rating_avg" | "reviews_count">): string {
  if (solution.rating_avg == null) return "Brak ocen";
  const avg = solution.rating_avg.toLocaleString("pl-PL", { minimumFractionDigits: 1 });
  return `${avg} / 5 · ${reviewsLabel(solution.reviews_count)}`;
}
