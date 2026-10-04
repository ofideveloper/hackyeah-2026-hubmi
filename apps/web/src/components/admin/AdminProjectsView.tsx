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

type ProjectDraft = {
  unit_id: string;
  name: string;
  description: string;
};

export function AdminProjectsView() {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [unitId, setUnitId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchUnits(), fetchProjects()])
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

  function startEdit(project: Project) {
    setError(null);
    setEditingId(project.id);
    setDraft({
      unit_id: project.unit_id,
      name: project.name,
      description: project.description,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unitId) return;
    setError(null);
    setBusy(true);
    try {
      const project = await createProject({
        unit_id: unitId,
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

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !draft) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await updateProject(editingId, {
        unit_id: draft.unit_id,
        name: draft.name,
        description: draft.description,
      });
      setProjects((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać projektu");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(projectId: string) {
    if (!window.confirm("Usunąć ten projekt?")) return;
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (editingId === projectId) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć projektu");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie projektów…</p>;
  }

  return (
    <div className="space-y-6">
      {units.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Najpierw dodaj{" "}
          <Link href="/admin/units" className="text-[var(--accent)] underline underline-offset-2">
            jednostkę organizacyjną
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onCreate} className="surface space-y-4 p-5">
          <p className="text-sm font-medium">Nowy projekt jednostki</p>
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
          {error && !editingId && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy && !editingId ? "Zapisywanie…" : "Utwórz i przydziel projekt"}
          </button>
        </form>
      )}

      <ul className="space-y-3">
        {projects.length === 0 && (
          <li className="text-sm text-[var(--muted)]">Brak projektów.</li>
        )}
        {projects.map((project) => (
          <li key={project.id} className="surface p-4">
            {editingId === project.id && draft ? (
              <form onSubmit={onSaveEdit} className="space-y-4">
                <p className="text-sm font-medium">Edycja projektu</p>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Jednostka</span>
                  <select
                    required
                    value={draft.unit_id}
                    onChange={(e) => setDraft({ ...draft, unit_id: e.target.value })}
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
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Nazwa</span>
                  <input
                    required
                    minLength={2}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="field"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Opis</span>
                  <textarea
                    required
                    minLength={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="field min-h-[100px]"
                  />
                </label>
                {error && (
                  <p className="text-sm text-[var(--danger)]" role="alert">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy ? "Zapisywanie…" : "Zapisz"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={cancelEdit}
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{project.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {project.unit_name ?? `Jednostka ${project.unit_id}`}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{project.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(project)}
                    className="btn-ghost text-sm"
                    disabled={units.length === 0}
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(project.id)}
                    className="btn-ghost text-sm"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
