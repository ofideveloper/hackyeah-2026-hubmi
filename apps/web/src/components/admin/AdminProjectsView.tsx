import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  createProject,
  deleteProject,
  fetchProjects,
  fetchUnits,
  updateProject,
  type OrganizationalUnit,
  type Project,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

export function AdminProjectsView() {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [unitId, setUnitId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([fetchUnits(token), fetchProjects(token)])
      .then(([nextUnits, nextProjects]) => {
        setUnits(nextUnits);
        setProjects(nextProjects);
        if (nextUnits[0]) setUnitId(String(nextUnits[0].id));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać danych"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || !unitId) return;
    setError(null);
    setBusy(true);
    try {
      const project = await createProject(token, {
        unit_id: Number(unitId),
        name,
        description,
      });
      setProjects((prev) => [project, ...prev]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać projektu");
    } finally {
      setBusy(false);
    }
  }

  async function onReassign(projectId: number, nextUnitId: number) {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await updateProject(token, projectId, { unit_id: nextUnitId });
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się przydzielić projektu");
    }
  }

  async function onDelete(projectId: number) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm("Usunąć ten projekt?")) return;
    try {
      await deleteProject(token, projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć projektu");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Ładowanie projektów…</p>;
  }

  return (
    <div className="space-y-6">
      {units.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Najpierw dodaj{" "}
          <Link href="/admin/units" className="text-[var(--accent)] hover:underline">
            jednostkę organizacyjną
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onCreate} className="surface space-y-4 p-5">
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Przydziel do jednostki</span>
            <select
              required
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="field"
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Nazwa projektu</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
              placeholder="np. Remont chodników 2026"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Opis</span>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="field min-h-[100px]"
              placeholder="Opis pod podpowiedzi AI…"
            />
          </label>
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Zapisywanie…" : "Utwórz i przydziel projekt"}
          </button>
        </form>
      )}

      <ul className="space-y-3">
        {projects.length === 0 && (
          <li className="text-sm text-[var(--muted)]">Brak projektów.</li>
        )}
        {projects.map((project) => (
          <li key={project.id} className="surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{project.name}</p>
                <p className="mt-2 text-sm leading-relaxed">{project.description}</p>
                <label className="mt-3 block max-w-sm text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Przydzielona jednostka</span>
                  <select
                    value={project.unit_id}
                    onChange={(e) => void onReassign(project.id, Number(e.target.value))}
                    className="field"
                    disabled={units.length === 0}
                  >
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => void onDelete(project.id)}
                className="btn-ghost text-sm"
              >
                Usuń
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
