import type { IdeaInput, IdeaStage } from "@/lib/api";

export const STAGE_LABEL: Record<IdeaStage, string> = {
  pomysl: "Pomysł",
  prototyp: "Prototyp",
  test_mikroskala: "Testowane w mikroskali",
  dobra_praktyka: "Dobra praktyka",
};

/** Limity pól fiszki — zgodne z `IdeaDraft` / `IdeaInput` w API. */
export const IDEA_FIELD_MAX = {
  name: 160,
  description: 1000,
  essence: 2000,
  audience: 1000,
  canvas: 1500,
  question: 1000,
} as const;

/** Pola Canvy innowacji społecznej — klucze zgodne z `IDEA_CANVAS_KEYS` w API. */
export const CANVAS_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "problem", label: "Problem", hint: "Jaką trudność i czyją chcesz rozwiązać?" },
  { key: "odbiorcy", label: "Odbiorcy", hint: "Kto skorzysta? Kto zdecyduje o wdrożeniu?" },
  { key: "rozwiazanie", label: "Rozwiązanie", hint: "Co dokładnie proponujesz i jak to działa?" },
  { key: "wartosc", label: "Wartość dla odbiorcy", hint: "Co zmieni się w życiu odbiorców?" },
  { key: "zasoby", label: "Zasoby", hint: "Ludzie, miejsce, sprzęt, budżet na test." },
  { key: "partnerzy", label: "Partnerzy", hint: "Kto może pomóc: instytucje, NGO, firmy?" },
  { key: "ryzyka", label: "Ryzyka", hint: "Co może pójść nie tak i jak to ograniczyć?" },
  { key: "efekty", label: "Miary efektu", hint: "Po czym poznasz, że rozwiązanie działa?" },
];

export const EMPTY_IDEA: IdeaInput = {
  name: "",
  description: "",
  essence: "",
  audience: "",
  stage: "pomysl",
  category_id: null,
  canvas: {},
};

/** Przycina fiszkę do limitów API — np. po wstawieniu długiej odpowiedzi asystenta. */
export function clipIdeaForApi(idea: IdeaInput): IdeaInput {
  return {
    ...idea,
    name: idea.name.slice(0, IDEA_FIELD_MAX.name),
    description: idea.description.slice(0, IDEA_FIELD_MAX.description),
    essence: idea.essence.slice(0, IDEA_FIELD_MAX.essence),
    audience: idea.audience.slice(0, IDEA_FIELD_MAX.audience),
    canvas: Object.fromEntries(
      Object.entries(idea.canvas).map(([key, value]) => [
        key,
        value.slice(0, IDEA_FIELD_MAX.canvas),
      ]),
    ),
  };
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL");
}
