import { useId, useState, type FormEvent } from "react";

import { ChatMarkdown } from "@/components/ChatMarkdown";
import { useAuth } from "@/hooks/useAuth";
import {
  askIdeaAssistant,
  type IdeaAssistantAction,
  type IdeaAssistantReply,
  type IdeaInput,
} from "@/lib/api";

const ACTIONS: { action: IdeaAssistantAction; label: string }[] = [
  { action: "develop", label: "Rozwiń pomysł" },
  { action: "unconventional", label: "Nietuzinkowe warianty" },
  { action: "canvas", label: "Wypełnij canvę" },
  { action: "visualize", label: "Zwizualizuj" },
];

type IdeaAssistantProps = {
  /** Bieżący stan formularza — asystent działa też na niezapisanej fiszce */
  idea: IdeaInput;
  /** Propozycje do canvy — rodzic wstawia je w puste pola i zwraca, ile uzupełnił */
  onCanvas: (canvas: Record<string, string>) => number;
};

/** Asystent kreatora innowacji: podpowiedzi do fiszki i szkic wizualizacji (SVG). */
export function IdeaAssistant({ idea, onCanvas }: IdeaAssistantProps) {
  const { canUseSession } = useAuth();
  const questionId = useId();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<IdeaAssistantReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<IdeaAssistantAction | null>(null);

  async function run(action: IdeaAssistantAction) {
    if (!canUseSession || busy) return;
    setError(null);
    setNotice(null);
    setBusy(action);
    try {
      const reply = await askIdeaAssistant(action, idea, question.trim());
      if (reply.canvas) {
        // canva trafia prosto do pól formularza, nie do panelu odpowiedzi
        const filled = onCanvas(reply.canvas);
        setNotice(
          filled > 0
            ? `Uzupełniono pola canvy: ${filled}. Wypełnione wcześniej zostały bez zmian.`
            : "Wszystkie pola canvy są już wypełnione — wyczyść pole, aby dostać propozycję.",
        );
      } else {
        setResult(reply);
      }
      if (action === "ask") setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Asystent nie odpowiedział");
    } finally {
      setBusy(null);
    }
  }

  function onAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim()) void run("ask");
  }

  return (
    <section className="surface space-y-4 p-5" aria-labelledby={`${questionId}-title`}>
      <div>
        <p className="kb-meta">Asystent kreatora innowacji</p>
        <h2 id={`${questionId}-title`} className="font-display mt-1 text-lg font-semibold">
          Rozwiń pomysł z AI
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Asystent czyta to, co wpisujesz w fiszce i canvie. Podpowiedzi przepisz do pól, które
          uznasz za trafne.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(({ action, label }) => (
          <button
            key={action}
            type="button"
            className="kb-chip"
            disabled={busy !== null}
            onClick={() => void run(action)}
          >
            {busy === action ? "Myślę…" : label}
          </button>
        ))}
      </div>

      <form onSubmit={onAsk} className="space-y-2">
        <label htmlFor={questionId} className="block text-sm text-[var(--muted)]">
          Własne pytanie albo wskazówka dla asystenta
        </label>
        <div className="flex gap-2">
          <input
            id={questionId}
            className="field"
            maxLength={1000}
            placeholder="np. Jak dotrzeć do seniorów na wsi?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" className="btn-ghost" disabled={busy !== null || !question.trim()}>
            {busy === "ask" ? "…" : "Zapytaj"}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite" aria-busy={busy !== null}>
        {notice && <p className="mb-3 text-sm font-medium text-[var(--accent-hover)]">{notice}</p>}
        {result?.svg ? (
          <figure>
            {/* SVG z modelu tylko jako obraz (data URI) — w <img> nie wykona się żaden skrypt */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`}
              alt={`Szkic wizualizacji pomysłu${idea.name ? `: ${idea.name}` : ""}`}
              className="w-full rounded-xl border border-[var(--border)] bg-white"
            />
            <figcaption className="mt-2 text-xs text-[var(--muted)]">
              Poglądowy szkic wygenerowany przez AI.
            </figcaption>
          </figure>
        ) : (
          result && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-sm">
              <ChatMarkdown content={result.reply} />
            </div>
          )
        )}
      </div>
    </section>
  );
}
