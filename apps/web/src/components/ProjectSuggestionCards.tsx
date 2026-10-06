import type { ChatProject } from "@/lib/api";

export type SuggestionCardItem = {
  id: string;
  name: string;
  description: string;
  unit_name?: string | null;
  interest_count?: number;
};

type ProjectSuggestionCardsProps = {
  projects: ChatProject[] | SuggestionCardItem[];
  onOpen?: (project: ChatProject) => void;
  label?: string;
  /** Podbicie zainteresowania — przycisk na karcie, bez otwierania podglądu. */
  onBoost?: (id: string) => void;
  busyId?: string | null;
};

function excerpt(text: string, max = 110): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

function asChatProject(project: SuggestionCardItem): ChatProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    unit_name: project.unit_name ?? null,
    interest_count: project.interest_count,
  };
}

export function ProjectSuggestionCards({
  projects,
  onOpen,
  label = "Zasugerowane projekty",
  onBoost,
  busyId = null,
}: ProjectSuggestionCardsProps) {
  if (!projects.length) return null;

  return (
    <div className="project-suggest-rail" aria-label={label}>
      <p className="project-suggest-label">{label}</p>
      <ul className="project-suggest-list">
        {projects.map((project, index) => {
          const openable = Boolean(onOpen);
          return (
            <li key={project.id} style={{ animationDelay: `${index * 60}ms` }}>
              <div className="project-suggest-card">
                <button
                  type="button"
                  className="project-suggest-card-main"
                  disabled={!openable}
                  aria-label={
                    openable ? `Zobacz projekt: ${project.name}` : project.name
                  }
                  onClick={() => onOpen?.(asChatProject(project))}
                >
                  <span className="project-suggest-card-top">
                    <span className="project-suggest-unit">
                      {project.unit_name ?? "Innowacja"}
                    </span>
                    {openable ? (
                      <span className="project-suggest-cta" aria-hidden>
                        Zobacz
                      </span>
                    ) : null}
                  </span>
                  <span className="font-display project-suggest-name">
                    {project.name}
                  </span>
                  <span className="project-suggest-excerpt">
                    {excerpt(project.description)}
                  </span>
                </button>
                {onBoost ? (
                  <div className="project-suggest-actions">
                    <button
                      type="button"
                      className="project-suggest-boost"
                      disabled={busyId === project.id}
                      onClick={() => onBoost(project.id)}
                    >
                      {busyId === project.id ? "Zapisuję…" : "Też mnie interesuje"}
                    </button>
                    {(project.interest_count ?? 0) > 0 ? (
                      <span className="project-suggest-interest">
                        zainteresowanych: {project.interest_count}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
