import { useEffect, useId, useMemo, useState } from "react";

import { InnovationDialog } from "@/components/knowledge/InnovationDialog";
import { fetchKnowledge, type InnovationSummary, type KnowledgeArea } from "@/lib/api";

const PAGE_SIZE = 20;

/** Przegląd katalogu `ActualProject` — tylko odczyt; szczegóły w oknie jak w Zasobniku. */
export function AdminCatalogView() {
  const searchId = useId();
  const [projects, setProjects] = useState<InnovationSummary[]>([]);
  const [areas, setAreas] = useState<KnowledgeArea[]>([]);
  const [query, setQuery] = useState("");
  const [areaId, setAreaId] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [opened, setOpened] = useState<InnovationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKnowledge()
      .then((data) => {
        setProjects(data.innovations);
        setAreas(data.areas);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać projektów"),
      )
      .finally(() => setLoading(false));
  }, []);

  // zmiana filtrów zaczyna listę od początku
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, areaId]);

  const areaNames = useMemo(() => new Map(areas.map((area) => [area.id, area.name])), [areas]);

  const shown = useMemo(() => {
    const words = query.toLocaleLowerCase("pl").split(/\s+/).filter(Boolean);
    return projects.filter((project) => {
      if (areaId && project.category_id !== areaId) return false;
      const haystack = `${project.name} ${project.solution} ${project.problem}`.toLocaleLowerCase(
        "pl",
      );
      return words.every((word) => haystack.includes(word));
    });
  }, [projects, query, areaId]);

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie projektów…</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label htmlFor={searchId} className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Szukaj w nazwie i opisie</span>
          <input
            id={searchId}
            type="search"
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Obszar</span>
          <select className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Wszystkie obszary</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name} ({area.innovations})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-[var(--muted)]" role="status">
        Projekty: {shown.length} z {projects.length}
      </p>

      <ul className="space-y-3">
        {shown.length === 0 && (
          <li className="text-sm text-[var(--muted)]">
            {projects.length === 0
              ? "Baza projektów jest pusta — dociągnij innowacje w zakładce Zasobnik wiedzy."
              : "Żaden projekt nie pasuje do filtrów."}
          </li>
        )}
        {shown.slice(0, visible).map((project) => (
          <li key={project.id} className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="kb-meta">
                  {[areaNames.get(project.category_id), project.has_video && "Film"]
                    .filter(Boolean)
                    .join(" · ") || "Bez obszaru"}
                </p>
                <h2 className="mt-1 text-base font-semibold">{project.name}</h2>
              </div>
              <button type="button" className="btn-ghost shrink-0" onClick={() => setOpened(project)}>
                Szczegóły<span className="sr-only">: {project.name}</span>
              </button>
            </div>
            {project.solution && (
              <p className="kb-clamp mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {project.solution}
              </p>
            )}
          </li>
        ))}
      </ul>

      {shown.length > visible && (
        <button type="button" className="btn-ghost" onClick={() => setVisible(visible + PAGE_SIZE)}>
          Pokaż więcej ({shown.length - visible})
        </button>
      )}

      {opened && (
        <InnovationDialog
          innovationId={opened.id}
          name={opened.name}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
