import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  fetchMyGrantApplication,
  saveGrantApplication,
  type GrantApplication,
  type GrantCall,
  type MyIdea,
} from "@/lib/api";
import { formatDate } from "@/lib/ideas";

const ANSWER_MAX = 4000;

type GrantApplicationFormProps = {
  call: GrantCall;
  ideas: MyIdea[];
};

/** Generator wniosku — pola formularza pochodzą z definicji konkretnego naboru. */
export function GrantApplicationForm({ call, ideas }: GrantApplicationFormProps) {
  const { canUseSession } = useAuth();
  const [application, setApplication] = useState<GrantApplication | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!canUseSession) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMyGrantApplication(call.id)
      .then((found) => {
        if (cancelled || !found) return;
        setApplication(found);
        setAnswers(found.answers);
        setIdeaId(found.idea_id);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nie udało się pobrać wniosku");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [call.id, canUseSession]);

  async function save(submit: boolean) {
    if (!canUseSession) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const saved = await saveGrantApplication(call.id, {
        idea_id: ideaId,
        answers,
        submit,
      });
      setApplication(saved);
      setNotice(submit ? "Wniosek został złożony." : "Zapisano szkic wniosku.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać wniosku");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (window.confirm("Złożyć wniosek? Po złożeniu nie będzie można go zmienić.")) {
      void save(true);
    }
  }

  /** Wstawia treść fiszki do pustych pól — punkt wyjścia do dopracowania. */
  function prefillFromIdea() {
    const idea = ideas.find((item) => item.id === ideaId);
    if (!idea) return;
    const text = [idea.description, idea.essence, idea.audience && `Odbiorcy: ${idea.audience}`]
      .filter(Boolean)
      .join("\n\n");
    const first = call.questions.find((question) => !answers[question.key]?.trim());
    if (first) setAnswers({ ...answers, [first.key]: text.slice(0, ANSWER_MAX) });
  }

  const submitted = application?.status === "zlozony";

  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kb-meta">
            Nabór otwarty do {formatDate(call.closes_on)}
          </p>
          <h3 className="font-display mt-1 text-lg font-semibold">{call.title}</h3>
        </div>
        {application && (
          <span className={`status-pill ${submitted ? "status-pill-done" : "status-pill-progress"}`}>
            {submitted ? "Wniosek złożony" : "Szkic"}
          </span>
        )}
      </div>
      {call.description && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
          {call.description}
        </p>
      )}

      <p aria-live="polite" className="mt-3 text-sm font-medium text-[var(--accent-hover)]">
        {notice}
      </p>
      {error && (
        <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="status">Ładowanie wniosku…</p>
      ) : submitted ? (
        <dl className="mt-4 space-y-4">
          {application.idea_title && (
            <div>
              <dt className="kb-dialog-heading">Pomysł</dt>
              <dd className="text-sm">{application.idea_title}</dd>
            </div>
          )}
          {call.questions.map((question) => (
            <div key={question.key}>
              <dt className="kb-dialog-heading">{question.label}</dt>
              <dd className="whitespace-pre-line text-sm leading-relaxed">
                {application.answers[question.key] ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-0 flex-1 text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Pomysł, którego dotyczy wniosek</span>
              <select
                className="field"
                value={ideaId ?? ""}
                onChange={(e) => setIdeaId(e.target.value || null)}
              >
                <option value="">Bez powiązania z fiszką</option>
                {ideas.map((idea) => (
                  <option key={idea.id} value={idea.id}>
                    {idea.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-ghost" disabled={!ideaId} onClick={prefillFromIdea}>
              Wstaw opis z fiszki
            </button>
          </div>

          {call.questions.map((question) => (
            <label key={question.key} className="block text-sm">
              <span className="mb-1.5 block font-medium">{question.label}</span>
              {question.hint && (
                <span className="mb-1.5 block text-[var(--muted)]">{question.hint}</span>
              )}
              <textarea
                required
                maxLength={ANSWER_MAX}
                className="field min-h-[96px]"
                value={answers[question.key] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [question.key]: e.target.value })}
              />
            </label>
          ))}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Zapisywanie…" : "Złóż wniosek"}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void save(false)}>
              Zapisz szkic
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
