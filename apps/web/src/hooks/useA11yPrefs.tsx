import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyA11yPrefs,
  DEFAULT_A11Y_PREFS,
  readStoredA11yPrefs,
  type A11yPrefs,
  type TextSize,
  writeStoredA11yPrefs,
} from "@/lib/a11yPrefs";

type A11yPrefsContextValue = A11yPrefs & {
  setTextSize: (size: TextSize) => void;
  setHighContrast: (enabled: boolean) => void;
  resetPrefs: () => void;
};

const A11yPrefsContext = createContext<A11yPrefsContextValue | null>(null);

export function A11yPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_A11Y_PREFS);

  // Odczyt po montowaniu — inline script w `_document` już ustawił atrybuty na html.
  useEffect(() => {
    const stored = readStoredA11yPrefs();
    setPrefs(stored);
    applyA11yPrefs(stored);
  }, []);

  const setTextSize = useCallback((textSize: TextSize) => {
    setPrefs((prev) => {
      const next = { ...prev, textSize };
      writeStoredA11yPrefs(next);
      return next;
    });
  }, []);

  const setHighContrast = useCallback((highContrast: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, highContrast };
      writeStoredA11yPrefs(next);
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    const next = { ...DEFAULT_A11Y_PREFS };
    writeStoredA11yPrefs(next);
    setPrefs(next);
  }, []);

  const value = useMemo(
    () => ({
      ...prefs,
      setTextSize,
      setHighContrast,
      resetPrefs,
    }),
    [prefs, setTextSize, setHighContrast, resetPrefs],
  );

  return <A11yPrefsContext.Provider value={value}>{children}</A11yPrefsContext.Provider>;
}

export function useA11yPrefs(): A11yPrefsContextValue {
  const ctx = useContext(A11yPrefsContext);
  if (!ctx) {
    throw new Error("useA11yPrefs wymaga A11yPrefsProvider");
  }
  return ctx;
}
