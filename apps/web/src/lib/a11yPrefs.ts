/** Preferencje dostępności — rozmiar tekstu i wysoki kontrast (localStorage). */

export const A11Y_STORAGE_KEY = "hubmi_a11y";

export const TEXT_SIZES = ["small", "medium", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export type A11yPrefs = {
  textSize: TextSize;
  highContrast: boolean;
};

export const DEFAULT_A11Y_PREFS: A11yPrefs = {
  textSize: "medium",
  highContrast: false,
};

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: "Mały",
  medium: "Średni",
  large: "Duży",
};

export function isTextSize(value: unknown): value is TextSize {
  return typeof value === "string" && (TEXT_SIZES as readonly string[]).includes(value);
}

export function parseA11yPrefs(raw: string | null): A11yPrefs {
  if (!raw) return { ...DEFAULT_A11Y_PREFS };
  try {
    const data = JSON.parse(raw) as Partial<A11yPrefs>;
    return {
      textSize: isTextSize(data.textSize) ? data.textSize : DEFAULT_A11Y_PREFS.textSize,
      highContrast: Boolean(data.highContrast),
    };
  } catch {
    return { ...DEFAULT_A11Y_PREFS };
  }
}

/** Ustawia atrybuty na `<html>` — CSS czyta `data-text-size` i `data-high-contrast`. */
export function applyA11yPrefs(prefs: A11yPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.textSize = prefs.textSize;
  if (prefs.highContrast) root.dataset.highContrast = "true";
  else delete root.dataset.highContrast;
}

export function readStoredA11yPrefs(): A11yPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_A11Y_PREFS };
  try {
    return parseA11yPrefs(window.localStorage.getItem(A11Y_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_A11Y_PREFS };
  }
}

export function writeStoredA11yPrefs(prefs: A11yPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // private mode / quota — preferencje działają tylko w tej sesji
  }
  applyA11yPrefs(prefs);
}
