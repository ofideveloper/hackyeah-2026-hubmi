import { useEffect, useState } from "react";

import {
  deleteIdea,
  fetchAdminIdeas,
  setIdeaStatus,
  type AdminIdea,
  type IdeaStatus,
} from "@/lib/api";
import { CANVAS_FIELDS, STAGE_LABEL } from "@/lib/ideas";

const STATUS: Record<IdeaStatus, { label: string; className: string }> = {
  pending: { label: "Oczekuje", className: "status-pill status-pill-new" },
  approved: { label: "Zatwierdzona", className: "status-pill status-pill-done" },
  rejected: { label: "Odrzucona", className: "status-pill status-pill-rejected" },
};

const FILTERS: { value: IdeaStatus | null; label: string }[] = [
  { value: null, label: "Wszystkie" },
  { value: "pending", label: "Oczekujące" },
  { value: "approved", label: "Zatwierdzone" },
  { value: "rejected", label: "Odrzucone" },
];

export function AdminIdeasView() {
  const [ideas, setIdeas] = useState<AdminIdea[]>([]);
  const [filter, setFilter] = useState<IdeaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // robocze komentarze, zanim trafią do autora razem z decyzją
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAdminIdeas()
      .then(setIdeas)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać fiszek"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onStatus(idea: AdminIdea, status: IdeaStatus) {
    setBusyId(idea.id);
    setError(null);
    try {
      const saved = await setIdeaStatus(idea.id, status, notes[idea.id] ?? idea.admin_note);
      setIdeas((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      setNotes((prev) => {
        const rest = { ...prev };
        delete rest[idea.id];
        return rest;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić statusu");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(idea: AdminIdea) {
    if (!window.confirm(`Trwale usunąć fiszkę „${idea.name}”?`)) return;
    setBusyId(idea.id);
    setError(null);
    try {
      await deleteIdea(idea.id);
      setIdeas((prev) => prev.filter((row) => row.id !== idea.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć fiszki");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie fiszek…</p>;
  }

  const shown = ideas.filter((idea) => !filter || idea.status === filter);

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr statusu">
        {FILTERS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            className="kb-chip"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label} ({value ? ideas.filter((idea) => idea.status === value).length : ideas.length})
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {shown.length === 0 && (
          <li className="text-sm text-[var(--muted)]">
            {ideas.length === 0 ? "Nikt nie zgłosił jeszcze fiszki." : "Brak fiszek o tym statusie."}
          </li>
        )}
        {shown.map((idea) => {
          const state = STATUS[idea.status] ?? STATUS.pending;
          const canvas = CANVAS_FIELDS.filter((field) => idea.canvas[field.key]);
          const busy = busyId === idea.id;
          return (
            <li key={idea.id} className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="kb-meta">
                    {[STAGE_LABEL[idea.stage] ?? idea.stage, idea.category_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <h2 className="mt-1 text-base font-semibold">{idea.name}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {[
                      idea.author_full_name,
                      idea.author_email,
                      new Date(idea.created_at).toLocaleString("pl-PL"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className={state.className}>{state.label}</span>
              </div>

              <dl className="mt-3 space-y-2 text-sm leading-relaxed">
                <div>
                  <dt className="font-semibold">Krótki opis</dt>
                  <dd className="whitespace-pre-line">{idea.description}</dd>
                </div>
                {idea.essence && (
                  <div>
                    <dt className="font-semibold">Istota pomysłu</dt>
                    <dd className="whitespace-pre-line">{idea.essence}</dd>
                  </div>
                )}
                {idea.audience && (
                  <div>
                    <dt className="font-semibold">Dla kogo</dt>
                    <dd className="whitespace-pre-line">{idea.audience}</dd>
                  </div>
                )}
              </dl>

              {canvas.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-[var(--accent-text)]">
                    Canva innowacji ({canvas.length}/{CANVAS_FIELDS.length})
                  </summary>
                  <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                    {canvas.map((field) => (
                      <div key={field.key}>
                        <dt className="text-xs font-semibold text-[var(--muted)]">{field.label}</dt>
                        <dd className="whitespace-pre-line leading-relaxed">
                          {idea.canvas[field.key]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}

              <label className="mt-4 block text-sm">
                <span className="font-semibold">Komentarz dla autora</span>
                <span className="ml-1 text-[var(--muted)]">
                  (opcjonalnie — autor dostanie go w wiadomości razem z decyzją)
                </span>
                <textarea
                  className="field mt-1 w-full"
                  rows={2}
                  maxLength={1000}
                  value={notes[idea.id] ?? idea.admin_note}
                  onChange={(event) =>
                    setNotes((prev) => ({ ...prev, [idea.id]: event.target.value }))
                  }
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                {notes[idea.id] !== undefined && notes[idea.id] !== idea.admin_note && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => void onStatus(idea, idea.status)}
                  >
                    Wyślij komentarz<span className="sr-only">: {idea.name}</span>
                  </button>
                )}
                {idea.status !== "approved" && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void onStatus(idea, "approved")}
                  >
                    Zatwierdź<span className="sr-only">: {idea.name}</span>
                  </button>
                )}
                {idea.status !== "rejected" && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => void onStatus(idea, "rejected")}
                  >
                    Odrzuć<span className="sr-only">: {idea.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => void onDelete(idea)}
                >
                  Usuń<span className="sr-only">: {idea.name}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
