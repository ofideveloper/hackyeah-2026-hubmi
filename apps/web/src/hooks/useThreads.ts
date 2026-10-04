import { useCallback, useEffect, useState } from "react";

import { fetchConversations, type Conversation } from "@/lib/api";
import { hasSessionHint } from "@/lib/auth";

const LIST_POLL_MS = 15000;

/**
 * Lista rozmów zalogowanego, odświeżana cyklicznie, gdy `active` i karta jest widoczna.
 * `threads === null` oznacza, że lista jeszcze się nie wczytała.
 */
export function useThreads(active: boolean) {
  const [threads, setThreads] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!hasSessionHint()) return;
    fetchConversations()
      .then((rows) => {
        setThreads(rows);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać rozmów"),
      );
  }, []);

  useEffect(() => {
    if (!active) return;
    reload();
    const timer = window.setInterval(() => {
      if (!document.hidden) reload();
    }, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, reload]);

  return { threads, error, reload };
}
