import { useEffect, useId, useRef, useState } from "react";

import { ChatMarkdown } from "@/components/ChatMarkdown";
import { ExternalLinkIcon } from "@/components/ExternalLinkIcon";
import { VideoEmbed } from "@/components/knowledge/VideoEmbed";
import {
  fetchInnovation,
  personalizeChatProject,
  type ChatProject,
  type InnovationDetail,
} from "@/lib/api";

type PreviewMode = "general" | "personal";

type ProjectPreviewModalProps = {
  project: ChatProject;
  /** Id rozmowy — kontekst do spersonalizowanej sugestii AI */
  chatId?: string | null;
  onClose: () => void;
};

/**
 * Podgląd propozycji z czatu — opis katalogowy albo sugestia AI pod tę rozmowę.
 */
export function ProjectPreviewModal({
  project,
  chatId = null,
  onClose,
}: ProjectPreviewModalProps) {
  const titleId = useId();
  const tabGeneralId = useId();
  const tabPersonalId = useId();
  const panelGeneralId = useId();
  const panelPersonalId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [mode, setMode] = useState<PreviewMode>("general");
  const [detail, setDetail] = useState<InnovationDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchInnovation(project.id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetailError(
            err instanceof Error ? err.message : "Nie udało się pobrać opisu innowacji",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Pre-fetch sugestii AI przy otwarciu — przełączenie na „Dla Ciebie” jest wtedy natychmiastowe.
  useEffect(() => {
    let cancelled = false;
    setAdvice(null);
    setAdviceError(null);
    setAdviceLoading(true);
    personalizeChatProject({ project_id: project.id, chat_id: chatId })
      .then((data) => {
        if (!cancelled) setAdvice(data.advice);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAdviceError(
            err instanceof Error ? err.message : "Nie udało się przygotować sugestii",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAdviceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, chatId]);

  const kicker = detail?.category_name || project.unit_name || null;

  return (
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
            <p className="project-modal-badge-inline">Propozycja interaktywnego asystenta</p>
            {kicker && <p className="project-modal-kicker">{kicker}</p>}
            <h2 id={titleId} className="font-display project-modal-title">
              {detail?.name || project.name}
            </h2>
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Zamknij
          </button>
        </div>

        <div
          className="project-preview-tabs"
          role="tablist"
          aria-label="Tryb podglądu projektu"
        >
          <button
            type="button"
            role="tab"
            id={tabGeneralId}
            aria-selected={mode === "general"}
            aria-controls={panelGeneralId}
            className={
              mode === "general"
                ? "project-preview-tab project-preview-tab-active"
                : "project-preview-tab"
            }
            onClick={() => setMode("general")}
          >
            O projekcie
          </button>
          <button
            type="button"
            role="tab"
            id={tabPersonalId}
            aria-selected={mode === "personal"}
            aria-controls={panelPersonalId}
            className={
              mode === "personal"
                ? "project-preview-tab project-preview-tab-active"
                : "project-preview-tab"
            }
            onClick={() => setMode("personal")}
          >
            Dla Ciebie
          </button>
        </div>

        {mode === "general" ? (
          <div
            id={panelGeneralId}
            role="tabpanel"
            aria-labelledby={tabGeneralId}
            className="mt-4"
          >
            {detailError && !detail && !project.description && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {detailError}
              </p>
            )}
            {!detail && !detailError && !project.description && (
              <p className="text-sm text-[var(--muted)]" role="status">
                Ładowanie opisu…
              </p>
            )}

            {detail ? (
              <>
                {detail.video_url && (
                  <div className="mb-5">
                    <VideoEmbed url={detail.video_url} title={detail.name} />
                  </div>
                )}
                {detail.sections.map((section, index) => (
                  <section key={`${index}-${section.title}`} className="kb-dialog-section">
                    {section.title && (
                      <h3 className="kb-dialog-heading">{section.title}</h3>
                    )}
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
            ) : (
              project.description && (
                <>
                  {!detailError && (
                    <p className="text-xs text-[var(--muted)]" role="status">
                      Ładowanie pełnego opisu…
                    </p>
                  )}
                  <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed">
                    {project.description}
                  </p>
                </>
              )
            )}
          </div>
        ) : (
          <div
            id={panelPersonalId}
            role="tabpanel"
            aria-labelledby={tabPersonalId}
            className="project-preview-personal mt-4"
          >
            <p className="project-preview-personal-lead">
              Rozbudowana sugestia AI na podstawie tej rozmowy: dopasowanie, scenariusze
              wdrożenia i pierwsze kroki właśnie dla Ciebie.
            </p>
            {adviceLoading && !advice && (
              <p className="mt-3 text-sm text-[var(--muted)]" role="status">
                Przygotowuję spersonalizowaną sugestię…
              </p>
            )}
            {adviceError && !advice && (
              <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                {adviceError}
              </p>
            )}
            {advice && (
              <div className="project-preview-advice">
                <ChatMarkdown content={advice} variant="caretaker" />
              </div>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
