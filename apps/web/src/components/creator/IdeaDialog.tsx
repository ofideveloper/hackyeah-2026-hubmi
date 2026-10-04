import { useEffect, useId, useRef } from "react";

import type { Idea, MyIdea } from "@/lib/api";
import { CANVAS_FIELDS, formatDate, STAGE_LABEL } from "@/lib/ideas";

const STATUS_LABEL: Record<Idea["status"], string> = {
  pending: "Czeka na ocenę zespołu ROPS",
  approved: "Zatwierdzony",
  rejected: "Nieprzyjęty",
};

export type IdeaDialogProps = {
  idea: Idea | MyIdea;
  onClose: () => void;
};

function hasCanvas(idea: Idea | MyIdea): idea is MyIdea {
  return "canvas" in idea && Boolean(idea.canvas);
}

/** Natywny `<dialog>` ze szczegółami zgłoszonego pomysłu. */
export function IdeaDialog({ idea, onClose }: IdeaDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasEntries = hasCanvas(idea)
    ? CANVAS_FIELDS.filter((field) => idea.canvas[field.key]?.trim())
    : [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    // Klik w tło natywnego <dialog> to dodatek dla myszy; klawiaturą zamyka Escape
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
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
      <div className="kb-dialog-body">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="project-modal-kicker">
              {[STAGE_LABEL[idea.stage], idea.category_name].filter(Boolean).join(" · ")}
            </p>
            <h2 id={titleId} className="font-display project-modal-title">
              {idea.name}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {STATUS_LABEL[idea.status]}
              {idea.author_name ? ` · ${idea.author_name}` : ""}
              {idea.created_at ? ` · ${formatDate(idea.created_at)}` : ""}
            </p>
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Zamknij
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold">Krótki opis</h3>
            <p className="mt-1 whitespace-pre-line text-[var(--muted)]">
              {idea.description}
            </p>
          </section>

          {idea.essence.trim() && (
            <section>
              <h3 className="font-semibold">Istota pomysłu</h3>
              <p className="mt-1 whitespace-pre-line text-[var(--muted)]">
                {idea.essence}
              </p>
            </section>
          )}

          {idea.audience.trim() && (
            <section>
              <h3 className="font-semibold">Dla kogo</h3>
              <p className="mt-1 whitespace-pre-line text-[var(--muted)]">
                {idea.audience}
              </p>
            </section>
          )}

          {canvasEntries.length > 0 && (
            <section>
              <h3 className="font-semibold">Szczegóły pomysłu</h3>
              <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                {canvasEntries.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {field.label}
                    </dt>
                    <dd className="mt-1 whitespace-pre-line">
                      {idea.canvas[field.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {"admin_note" in idea && idea.admin_note.trim() && (
            <section className="rounded-xl bg-[var(--accent-soft)] px-3 py-2.5">
              <h3 className="font-semibold">Komentarz zespołu ROPS</h3>
              <p className="mt-1 whitespace-pre-line">{idea.admin_note}</p>
            </section>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </dialog>
  );
}
