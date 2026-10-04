/**
 * Okno zgłoszenia nowego projektu - otwierane, gdy opiekun nie znalazł
 * dopasowania w bazie. Szkic z czatu można poprawić przed wysłaniem.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { createProjectProposal, type NewProjectDraft, type ProjectProposal } from "@/lib/api";
import { hasSessionHint } from "@/lib/auth";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Natywny `<dialog>`: pułapka fokusu, Escape i powrót fokusu bez własnego kodu
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSessionHint() || saving) return;

    setSaving(true);
    setError(null);
    try {
      onCreated(
        await createProjectProposal({
          name: name.trim(),
          description: description.trim(),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać propozycji");
      setSaving(false);
    }
  }

  return (
    // Klik w tło natywnego <dialog> to dodatek dla myszy; klawiaturą zamyka Escape (onCancel)
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className="kb-dialog kb-dialog-narrow"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !saving) onClose();
      }}
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
              <button type="button" className="btn-ghost" onClick={onClose}>
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
    </dialog>
  );
}
