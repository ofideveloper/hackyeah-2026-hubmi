/**
 * Czat mieszkańca — ciepły, prosty UX.
 * Bez export / import / zapisu rozmowy.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { sendChatMessage } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type ChatRole = "user" | "assistant" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
};

const CARETAKER = "Twój społeczny opiekun";

const SUGGESTIONS = [
  "Szukam pomocy w mojej dzielnicy",
  "Nie wiem, od czego zacząć",
  "Potrzebuję wsparcia",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-0.5" aria-label={`${CARETAKER} pisze`}>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
    </div>
  );
}

function CaretakerMark({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const icon = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div
      className={`chat-caretaker-avatar flex shrink-0 items-center justify-center rounded-full ${dim}`}
      aria-hidden
    >
      {/* Symbol opieki: dwie sylwetki + serce */}
      <svg className={icon} viewBox="0 0 32 32" fill="none">
        <circle cx="11" cy="11" r="3.2" fill="currentColor" opacity="0.95" />
        <circle cx="21" cy="11" r="3.2" fill="currentColor" opacity="0.95" />
        <path
          d="M6.5 22.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M14.5 22.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M16 26.2c-.35-.28-2.2-1.55-2.9-3-.7-1.5-.3-2.7.8-3 .6-.15 1.15.1 1.55.55.4-.45.95-.7 1.55-.55 1.1.3 1.5 1.5.8 3-.7 1.45-2.55 2.72-2.9 3Z"
          fill="#dff7f3"
        />
      </svg>
    </div>
  );
}

function renderPlain(content: string, onAccent = false) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={index}
          className={onAccent ? "font-semibold text-white" : "font-semibold text-[var(--text)]"}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

type AssistantChatProps = {
  userName?: string | null;
};

export function AssistantChat({ userName }: AssistantChatProps) {
  const displayName = userName?.trim() || "mieszkańcu";
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content:
        `Miło Cię widzieć. Jestem Twoim społecznym opiekunem — razem pomyślimy nad rozwiązaniem. ` +
        `Napisz, co Cię zajmuje, albo wybierz podpowiedź poniżej.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const onlyWelcome = messages.length === 1 && messages[0]?.id === "welcome";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const token = getToken();
    if (!token) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const reply = await sendChatMessage(token, trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "error",
          content: err instanceof Error ? err.message : "Nie udało się uzyskać odpowiedzi",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  return (
    <section className="chat-shell animate-fade-up overflow-hidden">
      <header className="chat-shell-header px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
        <div className="flex items-start gap-4">
          <CaretakerMark />
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {CARETAKER}
            </p>
            <h2 className="font-display mt-1.5 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
              Witaj, {displayName}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              Opowiedz, co Cię zajmuje — razem pomyślimy nad rozwiązaniem.
            </p>
          </div>
        </div>
      </header>

      <div
        ref={listRef}
        className="chat-thread max-h-[420px] min-h-[260px] space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {messages.map((message, index) => {
          const prev = messages[index - 1];
          const isCaretaker = message.role !== "user";
          const showMark = isCaretaker && (!prev || prev.role === "user");
          return (
            <div key={message.id} data-role={message.role} className="animate-soft-in">
              <div
                className={`flex items-end gap-2.5 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {isCaretaker &&
                  (showMark ? (
                    <CaretakerMark size="sm" />
                  ) : (
                    <div className="w-9 shrink-0" aria-hidden />
                  ))}
                <div
                  className={`max-w-[min(100%,28rem)] ${
                    message.role === "user" ? "items-end" : "items-start"
                  } flex flex-col`}
                >
                  <div
                    className={`px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap ${
                      message.role === "user"
                        ? "chat-bubble-user"
                        : message.role === "error"
                          ? "chat-bubble-error"
                          : "chat-bubble-caretaker"
                    }`}
                  >
                    {renderPlain(message.content, message.role === "user")}
                  </div>
                  <p
                    className={`mt-1.5 px-1 text-[11px] text-[var(--muted)] ${
                      message.role === "user" ? "self-end" : "self-start"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex items-end gap-2.5">
            <CaretakerMark size="sm" />
            <div className="chat-bubble-caretaker px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      {onlyWelcome && !busy && (
        <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-6">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void submitMessage(suggestion)}
              className="chat-chip"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="chat-composer border-t border-[var(--border)] px-4 py-4 sm:px-6">
        <div className="flex items-end gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Twoja wiadomość</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              disabled={busy}
              placeholder="Napisz, czego potrzebujesz…"
              className="chat-input"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-primary chat-send"
            aria-label="Wyślij wiadomość"
          >
            <span className="hidden sm:inline">Wyślij</span>
            <svg
              className="h-5 w-5 sm:hidden"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Enter wysyła · Shift+Enter nowa linia
        </p>
      </form>
    </section>
  );
}
