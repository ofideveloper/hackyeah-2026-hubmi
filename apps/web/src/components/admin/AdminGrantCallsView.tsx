import { useEffect, useState, type FormEvent } from "react";

import {
  deleteGrantCall,
  fetchAdminGrantCalls,
  fetchGrantApplications,
  saveGrantCall,
  type GrantApplication,
  type GrantCall,
  type GrantCallInput,
} from "@/lib/api";
import { hasSessionHint } from "@/lib/auth";
import { formatDate } from "@/lib/ideas";

const EMPTY_QUESTION = { key: "", label: "", hint: "" };

const EMPTY: GrantCallInput = {
  title: "",
  description: "",
  opens_on: "",
  closes_on: "",
  questions: [EMPTY_QUESTION],
};

function callState(call: GrantCall): { label: string; className: string } {
  if (call.is_open) return { label: "Trwa", className: "status-pill status-pill-progress" };
  const upcoming = call.opens_on > new Date().toISOString().slice(0, 10);
  return upcoming
    ? { label: "Zaplanowany", className: "status-pill status-pill-new" }
    : { label: "Zakończony", className: "status-pill status-pill-done" };
}

export function AdminGrantCallsView() {
  const [calls, setCalls] = useState<GrantCall[]>([]);
  const [form, setForm] = useState<GrantCallInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ callId: string; rows: GrantApplication[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSessionHint()) return;
    fetchAdminGrantCalls()
      .then(setCalls)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać naborów"),
      )
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function startEdit(call: GrantCall) {
    setError(null);
    setNotice(null);
    setEditingId(call.id);
    setForm({
      title: call.title,
      description: call.description,
      opens_on: call.opens_on,
      closes_on: call.closes_on,
      questions: call.questions,
    });
    document.getElementById("grant-form")?.scrollIntoView({ block: "start" });
  }

  function setQuestion(index: number, patch: Partial<GrantCallInput["questions"][number]>) {
    setForm({
      ...form,
      questions: form.questions.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSessionHint()) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const saved = await saveGrantCall(form, editingId);
      setCalls((prev) => {
        const previous = prev.find((call) => call.id === saved.id);
        const merged = {
          ...saved,
          applications_submitted:
            saved.applications_submitted ?? previous?.applications_submitted ?? 0,
        };
        return [merged, ...prev.filter((call) => call.id !== saved.id)].sort((a, b) =>
          b.opens_on.localeCompare(a.opens_on),
        );
      });
      setNotice(editingId ? "Zapisano zmiany w naborze." : "Dodano nabór.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać naboru");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(call: GrantCall) {
    if (!hasSessionHint()) return;
    if (!window.confirm(`Usunąć nabór „${call.title}” razem ze szkicami wniosków?`)) return;
    try {
      await deleteGrantCall(call.id);
      setCalls((prev) => prev.filter((item) => item.id !== call.id));
      if (editingId === call.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć naboru");
    }
  }

  async function toggleApplications(call: GrantCall) {
    if (opened?.callId === call.id) {
      setOpened(null);
      return;
    }
    if (!hasSessionHint()) return;
    try {
      setOpened({ callId: call.id, rows: await fetchGrantApplications(call.id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się pobrać wniosków");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie naborów…</p>;
  }

  return (
    <div className="space-y-8">
      <p aria-live="polite" className="text-sm font-medium text-[var(--accent-hover)]">
        {notice}
      </p>
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <form id="grant-form" onSubmit={onSubmit} className="surface space-y-4 p-5">
        <h2 className="text-base font-semibold">{editingId ? "Edycja naboru" : "Nowy nabór"}</h2>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Nazwa naboru</span>
          <input
            required
            minLength={2}
            maxLength={255}
            className="field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Początek naboru</span>
            <input
              required
              type="date"
              className="field"
              value={form.opens_on}
              onChange={(e) => setForm({ ...form, opens_on: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Koniec naboru (włącznie)</span>
            <input
              required
              type="date"
              min={form.opens_on || undefined}
              className="field"
              value={form.closes_on}
              onChange={(e) => setForm({ ...form, closes_on: e.target.value })}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Opis i zasady (opcjonalnie)</span>
          <textarea
            maxLength={4000}
            className="field min-h-[88px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Pola wniosku</legend>
          {form.questions.map((question, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[2fr_2fr_auto]">
              <input
                required
                minLength={2}
                maxLength={300}
                className="field"
                aria-label={`Pytanie ${index + 1}`}
                placeholder={`Pytanie ${index + 1}, np. Cel projektu`}
                value={question.label}
                onChange={(e) => setQuestion(index, { label: e.target.value })}
              />
              <input
                maxLength={500}
                className="field"
                aria-label={`Podpowiedź do pytania ${index + 1}`}
                placeholder="Podpowiedź (opcjonalnie)"
                value={question.hint}
                onChange={(e) => setQuestion(index, { hint: e.target.value })}
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={form.questions.length === 1}
                onClick={() =>
                  setForm({ ...form, questions: form.questions.filter((_, i) => i !== index) })
                }
              >
                Usuń<span className="sr-only"> pytanie {index + 1}</span>
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost"
            disabled={form.questions.length >= 20}
            onClick={() => setForm({ ...form, questions: [...form.questions, EMPTY_QUESTION] })}
          >
            Dodaj pytanie
          </button>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Zapisywanie…" : editingId ? "Zapisz zmiany" : "Dodaj nabór"}
          </button>
          {editingId && (
            <button type="button" className="btn-ghost" disabled={busy} onClick={resetForm}>
              Anuluj
            </button>
          )}
        </div>
      </form>

      <section>
        <h2 className="text-base font-semibold">Nabory ({calls.length})</h2>
        <ul className="mt-3 space-y-3">
          {calls.length === 0 && (
            <li className="text-sm text-[var(--muted)]">
              Brak naborów — generator wniosków jest ukryty w Kreatorze pomysłów.
            </li>
          )}
          {calls.map((call) => {
            const state = callState(call);
            const isOpened = opened?.callId === call.id;
            return (
              <li key={call.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{call.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatDate(call.opens_on)} – {formatDate(call.closes_on)} · pól wniosku:{" "}
                      {call.questions.length} · złożonych wniosków:{" "}
                      {call.applications_submitted ?? 0}
                    </p>
                  </div>
                  <span className={state.className}>{state.label}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-expanded={isOpened}
                    onClick={() => void toggleApplications(call)}
                  >
                    {isOpened ? "Ukryj wnioski" : "Pokaż wnioski"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => startEdit(call)}>
                    Edytuj
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => void onDelete(call)}>
                    Usuń
                  </button>
                </div>
                {isOpened && (
                  <ul className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                    {opened.rows.length === 0 && (
                      <li className="text-sm text-[var(--muted)]">Brak złożonych wniosków.</li>
                    )}
                    {opened.rows.map((row) => (
                      <li key={row.id}>
                        <p className="text-sm font-medium">
                          {row.author_name || row.author_email}
                          {row.idea_title && ` — ${row.idea_title}`}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {row.author_email}
                          {row.submitted_at &&
                            ` · złożono ${new Date(row.submitted_at).toLocaleString("pl-PL")}`}
                        </p>
                        <dl className="mt-2 space-y-2">
                          {call.questions.map((question) => (
                            <div key={question.key}>
                              <dt className="text-xs font-semibold text-[var(--muted)]">
                                {question.label}
                              </dt>
                              <dd className="whitespace-pre-line text-sm leading-relaxed">
                                {row.answers[question.key] ?? "—"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
