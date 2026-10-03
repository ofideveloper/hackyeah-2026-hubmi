/**
 * Uproszczony czat inspirowany UI z website-aivoxpop (Chat.tsx):
 * bąbelki, typing indicator, textarea + send.
 * Bez export / import / zapisu rozmowy / Clerk / mentions.
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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Asystent pisze">
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" />
    </div>
  );
}

function renderPlain(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-[var(--text)]">
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content:
        `Cześć${userName ? `, ${userName}` : ""}! Wpisz nazwę projektu lub słowo kluczowe — dam informację zwrotną ` +
        "(jednostka, opis, kolejny krok). Rozmowa nie jest zapisywana.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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
    <section className="surface flex flex-col p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Asystent HubMI</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Np. fragment nazwy projektu — bez eksportu i bez zapisu rozmowy.
        </p>
      </div>

      <div
        ref={listRef}
        className="mb-4 max-h-[360px] min-h-[220px] space-y-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"
      >
        {messages.map((message) => (
          <div key={message.id} data-role={message.role}>
            <div
              className={`flex items-start gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role !== "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                  AI
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-[var(--accent)] text-white"
                    : message.role === "error"
                      ? "border border-[var(--danger)] bg-white text-[var(--danger)]"
                      : "border border-[var(--border)] bg-white text-[var(--text)]"
                }`}
              >
                {renderPlain(message.content)}
              </div>
              {message.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-xs font-semibold text-[var(--muted)]">
                  Ty
                </div>
              )}
            </div>
            <p
              className={`mt-1 text-xs text-[var(--muted)] ${
                message.role === "user" ? "text-right pr-11" : "pl-11"
              }`}
            >
              {message.timestamp.toLocaleTimeString("pl-PL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ))}

        {busy && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
              AI
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-3.5 py-2.5">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          disabled={busy}
          placeholder="np. nazwa projektu lub słowo kluczowe…"
          className="field min-h-[72px] flex-1 resize-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="btn-primary h-11 shrink-0 px-4"
          aria-label="Wyślij"
        >
          Wyślij
        </button>
      </form>
    </section>
  );
}
