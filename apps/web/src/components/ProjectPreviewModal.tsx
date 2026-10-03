import { useEffect, useId, useRef } from "react";

import type { ChatProject } from "@/lib/api";

type ProjectPreviewModalProps = {
  project: ChatProject;
  onClose: () => void;
};

/** Natywny `<dialog>`: pułapka fokusu, Escape i powrót fokusu do karty bez własnego kodu. */
export function ProjectPreviewModal({ project, onClose }: ProjectPreviewModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    // Klik w tło natywnego <dialog> to dodatek dla myszy; klawiaturą zamyka Escape (onCancel)
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className="kb-dialog kb-dialog-narrow"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape — zamykamy przez stan rodzica, nie przez zdarzenie `close`
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // klik w tło (sam element dialog, nie jego zawartość) zamyka okno
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="project-modal-hero" aria-hidden="true">
        <span className="project-modal-badge">Propozycja opiekuna</span>
      </div>

      <div className="project-modal-body">
        {project.unit_name ? (
          <p className="project-modal-kicker">{project.unit_name}</p>
        ) : null}
        <h2 id={titleId} className="font-display project-modal-title">
          {project.name}
        </h2>
        <p className="project-modal-desc">{project.description}</p>

        <div className="project-modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </dialog>
  );
}
