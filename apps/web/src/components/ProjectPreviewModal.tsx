import { InnovationDialog } from "@/components/knowledge/InnovationDialog";
import type { ChatProject } from "@/lib/api";

type ProjectPreviewModalProps = {
  project: ChatProject;
  onClose: () => void;
};

/**
 * Podgląd propozycji interaktywnego asystenta — ten sam układ co innowacja w `/wiedza`
 * (sekcje opisu, film, folder PDF, strona ROPS).
 */
export function ProjectPreviewModal({ project, onClose }: ProjectPreviewModalProps) {
  return (
    <InnovationDialog
      innovationId={project.id}
      name={project.name}
      badge="Propozycja interaktywnego asystenta"
      fallbackDescription={project.description}
      onClose={onClose}
    />
  );
}
