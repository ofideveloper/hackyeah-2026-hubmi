import { useEffect, useId, useRef, useState } from "react";

import { ExternalLinkIcon } from "@/components/ExternalLinkIcon";
import { VideoEmbed } from "@/components/knowledge/VideoEmbed";
import { fetchInnovation, type InnovationDetail } from "@/lib/api";

type InnovationDialogProps = {
  innovationId: string;
  /** Nazwa znana z listy — nagłówek widać, zanim dojdą szczegóły */
  name: string;
  onClose: () => void;
};

/** Natywny `<dialog>`: pułapka fokusu, Escape i powrót fokusu do karty bez własnego kodu. */
export function InnovationDialog({ innovationId, name, onClose }: InnovationDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<InnovationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchInnovation(innovationId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Nie udało się pobrać opisu innowacji");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [innovationId]);

  return (
    // Klik w tło natywnego <dialog> to dodatek dla myszy; klawiaturą zamyka Escape (onCancel)
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className="kb-dialog"
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
      <div className="kb-dialog-body">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="project-modal-kicker">{detail?.category_name || "Innowacja społeczna"}</p>
            <h2 id={titleId} className="font-display project-modal-title">
              {name}
            </h2>
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Zamknij
          </button>
        </div>

        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {!detail && !error && (
          <p className="text-sm text-[var(--muted)]" role="status">
            Ładowanie opisu…
          </p>
        )}

        {detail && (
          <>
            {detail.video_url && (
              <div className="mb-5">
                <VideoEmbed url={detail.video_url} title={detail.name} />
              </div>
            )}

            {detail.sections.map((section, index) => (
              <section key={`${index}-${section.title}`} className="kb-dialog-section">
                {section.title && <h3 className="kb-dialog-heading">{section.title}</h3>}
                <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed">
                  {section.body}
                </p>
              </section>
            ))}

            {(detail.folder_url || detail.source_url) && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {detail.folder_url && (
                  <li>
                    <a
                      href={detail.folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                    >
                      Folder innowacji (PDF)
                      <ExternalLinkIcon />
                      <span className="sr-only"> (otwiera się w nowej karcie)</span>
                    </a>
                  </li>
                )}
                {detail.source_url && (
                  <li>
                    <a
                      href={detail.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost"
                    >
                      Strona w Bibliotece ROPS
                      <ExternalLinkIcon />
                      <span className="sr-only"> (otwiera się w nowej karcie)</span>
                    </a>
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
