import type { ChatProject } from "@/lib/api";

type ProjectSuggestionCardsProps = {
  projects: ChatProject[];
  onOpen: (project: ChatProject) => void;
};

export function ProjectSuggestionCards({ projects, onOpen }: ProjectSuggestionCardsProps) {
  if (!projects.length) return null;

  return (
    <div className="project-suggest-rail" aria-label="Sugerowane projekty">
      <p className="project-suggest-label">Zasugerowane projekty</p>
      <ul className="project-suggest-list">
        {projects.map((project, index) => (
          <li key={project.id} style={{ animationDelay: `${index * 60}ms` }}>
            <button
              type="button"
              className="project-suggest-card"
              onClick={() => onOpen(project)}
            >
              <span className="project-suggest-card-top">
                <span className="project-suggest-unit">
                  {project.unit_name ?? "Jednostka"}
                </span>
                <span className="project-suggest-cta" aria-hidden>
                  Zobacz
                </span>
              </span>
              <span className="font-display project-suggest-name">{project.name}</span>
              <span className="project-suggest-excerpt">
                {project.description.length > 110
                  ? `${project.description.slice(0, 110).trim()}…`
                  : project.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
