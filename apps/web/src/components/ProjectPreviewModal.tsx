import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import type { Project } from "@/lib/api";

type ProjectPreviewModalProps = {
  project: Project;
  onClose: () => void;
};

export function ProjectPreviewModal({ project, onClose }: ProjectPreviewModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
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
        <div className="project-modal-hero" aria-hidden>
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
            <button ref={closeRef} type="button" className="btn-primary" onClick={onClose}>
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
