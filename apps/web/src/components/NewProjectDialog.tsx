/**
 * Okno zgłoszenia nowego projektu - otwierane, gdy opiekun nie znalazł
 * dopasowania w bazie. Szkic z czatu można poprawić przed wysłaniem.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { createProjectProposal, type NewProjectDraft, type ProjectProposal } from "@/lib/api";
import { getToken } from "@/lib/auth";

type NewProjectDialogProps = {
  draft: NewProjectDraft;
  /** Gość nie ma konta - zamiast formularza dostaje zachętę do rejestracji */
  guestMode?: boolean;
  onClose: () => void;
  onCreated: (proposal: ProjectProposal) => void;
};

export function NewProjectDialog({
  draft,
  guestMode = false,
  onClose,
  onCreated,
}: NewProjectDialogProps) {
  const titleId = useId();
  const errorId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (firstFieldRef.current ?? closeRef.current)?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || saving) return;

    setSaving(true);
    setError(null);
    try {
      onCreated(
        await createProjectProposal(token, {
          name: name.trim(),
          description: description.trim(),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać propozycji");
      setSaving(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="project-modal-root" role="presentation" onClick={onClose}>
      <div
        className="project-modal animate-fade-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="project-modal-body">
          <p className="project-modal-kicker">Brak dopasowania w bazie</p>
          <h2 id={titleId} className="font-display project-modal-title">
            Zgłoś nowy projekt
          </h2>

          {guestMode ? (
            <>
              <p className="project-modal-desc">
                Żeby przekazać propozycję zespołowi, potrzebne jest konto. Szkic z rozmowy:
                {"\n\n"}
                {draft.name ? `${draft.name}\n` : ""}
                {draft.description}
              </p>
              <div className="project-modal-actions gap-2">
                <button ref={closeRef} type="button" className="btn-ghost" onClick={onClose}>
                  Zamknij
                </button>
                <Link href="/register" className="btn-primary">
                  Załóż konto
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <p className="text-sm text-[var(--muted)]">
                Przygotowałem szkic na podstawie rozmowy - popraw go, zanim trafi do zespołu.
              </p>
              <div className="mt-4 space-y-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Nazwa</span>
                  <input
                    ref={firstFieldRef}
                    type="text"
                    required
                    minLength={2}
                    maxLength={255}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-describedby={error ? errorId : undefined}
                    className="field"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Opis potrzeby</span>
                  <textarea
                    required
                    minLength={2}
                    maxLength={5000}
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="field"
                  />
                </label>
              </div>

              {error && (
                <p id={errorId} className="mt-4 text-sm text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}

              <div className="project-modal-actions gap-2">
                <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
                  Anuluj
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Wysyłam…" : "Wyślij propozycję"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
