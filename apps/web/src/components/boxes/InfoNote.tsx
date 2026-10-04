import type { ReactNode } from "react";

export type InfoNoteTone = "info" | "success" | "muted";

export type InfoNoteProps = {
  children: ReactNode;
  /** Domyślnie `info`. */
  tone?: InfoNoteTone;
  /** Krótka etykieta przed treścią, np. „Podpowiedź”. */
  label?: string;
  className?: string;
  /** Domyślnie `status` — dla komunikatów po akcji użyj `alert` albo `polite` przez role. */
  role?: "status" | "alert" | "note";
};

const toneClass: Record<InfoNoteTone, string> = {
  info: "info-note info-note-info",
  success: "info-note info-note-success",
  muted: "info-note info-note-muted",
};

/** Lekki box informacyjny — podpowiedzi, statusy, krótkie wyjaśnienia. */
export function InfoNote({
  children,
  tone = "info",
  label = "Podpowiedź",
  className,
  role = "status",
}: InfoNoteProps) {
  return (
    <p
      role={role}
      className={[toneClass[tone], className].filter(Boolean).join(" ")}
    >
      <span className="info-note-icon" aria-hidden="true">
        i
      </span>
      <span className="info-note-body">
        {label ? <span className="info-note-label">{label}</span> : null}
        <span className="info-note-text">{children}</span>
      </span>
    </p>
  );
}
