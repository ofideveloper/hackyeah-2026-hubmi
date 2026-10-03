import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { MESSAGE_BODY_MAX, THREAD_SUBJECT_MAX } from "@/lib/communication";

type ComposeDialogProps = {
  kicker: string;
  title: string;
  /** Temat podaje autor (pytanie, mentor); odpowiedź na ogłoszenie dziedziczy jego tytuł */
  withSubject: boolean;
  bodyLabel: string;
  submitLabel: string;
  /** Rzucony błąd zostaje pokazany w oknie; po sukcesie rodzic zamyka okno */
  onSubmit: (values: { subject: string; body: string }) => Promise<void>;
  onClose: () => void;
};

/** Pierwsza wiadomość nowej rozmowy — natywny `<dialog>` (Esc zamyka, fokus wraca do przycisku). */
export function ComposeDialog({
  kicker,
  title,
  withSubject,
  bodyLabel,
  submitLabel,
  onSubmit,
  onClose,
}: ComposeDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ subject: subject.trim(), body: body.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać wiadomości");
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="kb-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={submit} className="kb-dialog-body space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="project-modal-kicker">{kicker}</p>
            <h2 id={titleId} className="font-display project-modal-title">
              {title}
            </h2>
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Zamknij
          </button>
        </div>

        {withSubject && (
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Temat</span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={THREAD_SUBJECT_MAX}
              className="field"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">{bodyLabel}</span>
          <textarea
            required
            maxLength={MESSAGE_BODY_MAX}
            className="field min-h-[120px]"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>

        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={busy || !body.trim()}>
          {submitLabel}
        </button>
      </form>
    </dialog>
  );
}
