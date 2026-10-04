import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  ApiError,
  fetchConversation,
  sendThreadMessage,
  setConversationStatus,
  type ConversationDetail,
  type ConversationStatus,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  formatDateTime,
  MESSAGE_BODY_MAX,
  THREAD_KIND_LABEL,
  THREAD_STATUS,
} from "@/lib/communication";

const POLL_MS = 5000;

type ThreadViewProps = {
  conversationId: string;
  /** Po każdej zmianie rozmowy (nowa wiadomość, odczyt, status) — rodzic odświeża listę */
  onChanged?: () => void;
};

function sameThread(prev: ConversationDetail | null, next: ConversationDetail): boolean {
  return (
    prev !== null &&
    prev.status === next.status &&
    prev.unread === next.unread &&
    prev.messages.length === next.messages.length &&
    prev.messages.at(-1)?.id === next.messages.at(-1)?.id
  );
}

/**
 * Jedna rozmowa: historia + pole wiadomości. Nowe wiadomości dochodzą przez cykliczne
 * odpytywanie API. Rodzic podaje `key={conversationId}`, żeby zmiana rozmowy czyściła stan.
 */
export function ThreadView({ conversationId, onChanged }: ThreadViewProps) {
  const titleId = useId();
  const logRef = useRef<HTMLOListElement>(null);
  const inFlight = useRef(false);
  const stopped = useRef(false);
  // rośnie przy każdym zapisie — odpowiedź odpytania rozpoczętego wcześniej jest już nieaktualna
  const writes = useRef(0);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || inFlight.current || stopped.current) return;
    inFlight.current = true;
    const startedAt = writes.current;
    try {
      const next = await fetchConversation(token, conversationId);
      if (startedAt !== writes.current) return;
      // bez zmian zostaje ten sam obiekt — czytnik ekranu nie dostaje powtórek, fokus zostaje
      setDetail((prev) => (sameThread(prev, next) ? prev : next));
      setError(null);
    } catch (err) {
      // brak dostępu albo wygasła sesja nie minie same — dalsze odpytywanie nie ma sensu
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        stopped.current = true;
      }
      setError(err instanceof Error ? err.message : "Nie udało się pobrać rozmowy");
    } finally {
      inFlight.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (detail) onChanged?.();
  }, [detail, onChanged]);

  const messageCount = detail?.messages.length ?? 0;
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messageCount]);

  async function write(action: (token: string) => Promise<ConversationDetail>, fallback: string) {
    const token = getToken();
    if (!token || busy) return false;
    setBusy(true);
    setError(null);
    writes.current += 1;
    try {
      setDetail(await action(token));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body) return;
    const sent = await write(
      (token) => sendThreadMessage(token, conversationId, body),
      "Nie udało się wysłać wiadomości",
    );
    if (sent) setDraft("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function onStatus(status: ConversationStatus) {
    void write(
      (token) => setConversationStatus(token, conversationId, status),
      "Nie udało się zmienić statusu rozmowy",
    );
  }

  if (!detail) {
    return error ? (
      <p className="text-sm text-[var(--danger)]" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-sm text-[var(--muted)]" role="status">
        Ładowanie rozmowy…
      </p>
    );
  }

  const state = THREAD_STATUS[detail.status];
  const closed = detail.status === "zamknieta";

  return (
    <section className="chat-shell overflow-hidden" aria-labelledby={titleId}>
      <header className="chat-shell-header flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="kb-meta">{THREAD_KIND_LABEL[detail.kind]}</p>
          <h3 id={titleId} className="font-display mt-1 text-lg font-semibold leading-snug">
            {detail.subject}
          </h3>
          <p className="mt-1 break-words text-sm text-[var(--muted)]">
            {[detail.counterpart_name, detail.counterpart_email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={state.className}>{state.label}</span>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => onStatus(closed ? "otwarta" : "zamknieta")}
          >
            {closed ? "Otwórz ponownie" : "Zamknij rozmowę"}
          </button>
        </div>
      </header>

      <ol
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={`Wiadomości w rozmowie: ${detail.subject}`}
        // przewijany region musi być osiągalny klawiaturą
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="chat-thread thread-log space-y-3 px-4 py-5 sm:px-6"
      >
        {detail.messages.map((message) => (
          <li key={message.id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-2.5 text-sm ${
                message.is_mine ? "chat-bubble-user" : "chat-bubble-caretaker"
              }`}
            >
              {/* autor tekstem — strona rozmowy nie może wynikać tylko z koloru dymka */}
              <p className="text-xs font-semibold">
                {message.is_mine ? "Ty" : (message.author_name ?? "Rozmówca")}
                {" · "}
                <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p className="px-4 pt-3 text-sm text-[var(--danger)] sm:px-6" role="alert">
          {error}
        </p>
      )}

      {closed ? (
        <p className="chat-composer border-t border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)] sm:px-6">
          Rozmowa jest zamknięta. Otwórz ją ponownie, aby napisać.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="chat-composer border-t border-[var(--border)] px-4 py-4 sm:px-6"
        >
          <div className="flex items-start gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Twoja wiadomość (Enter wysyła, Shift+Enter nowa linia)</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                maxLength={MESSAGE_BODY_MAX}
                placeholder="Napisz wiadomość…"
                className="chat-input"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="chat-send"
              aria-label="Wyślij wiadomość"
              title="Wyślij"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
