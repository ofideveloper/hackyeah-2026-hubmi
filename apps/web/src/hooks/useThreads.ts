import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { fetchConversations, type Conversation } from "@/lib/api";

const LIST_POLL_MS = 15000;

/**
 * Lista rozmów zalogowanego, odświeżana cyklicznie, gdy `active` i karta jest widoczna.
 * `threads === null` oznacza, że lista jeszcze się nie wczytała.
 */
export function useThreads(active: boolean) {
  const { canUseSession } = useAuth();
  const [threads, setThreads] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!canUseSession) return;
    fetchConversations()
      .then((rows) => {
        setThreads(rows);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać rozmów"),
      );
  }, [canUseSession]);

  useEffect(() => {
    if (!active || !canUseSession) return;
    reload();
    const timer = window.setInterval(() => {
      if (!document.hidden) reload();
    }, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, canUseSession, reload]);

  return { threads, error, reload };
}
