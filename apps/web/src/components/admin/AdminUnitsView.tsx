import { useEffect, useState, type FormEvent } from "react";

import {
  createUnit,
  deleteUnit,
  fetchUnits,
  updateUnit,
  type OrganizationalUnit,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

type UnitDraft = {
  name: string;
  territory: string;
  competencies: string;
};

export function AdminUnitsView() {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [name, setName] = useState("");
  const [territory, setTerritory] = useState("");
  const [competencies, setCompetencies] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UnitDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetchUnits(token)
      .then(setUnits)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać jednostek"),
      )
      .finally(() => setLoading(false));
  }, []);

  function startEdit(unit: OrganizationalUnit) {
    setError(null);
    setEditingId(unit.id);
    setDraft({
      name: unit.name,
      territory: unit.territory,
      competencies: unit.competencies,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const unit = await createUnit(token, { name, territory, competencies });
      setUnits((prev) => [...prev, unit].sort((a, b) => a.name.localeCompare(b.name, "pl")));
      setName("");
      setTerritory("");
      setCompetencies("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać jednostki");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || !editingId || !draft) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await updateUnit(token, editingId, {
        name: draft.name,
        territory: draft.territory,
        competencies: draft.competencies,
      });
      setUnits((prev) =>
        prev
          .map((u) => (u.id === editingId ? updated : u))
          .sort((a, b) => a.name.localeCompare(b.name, "pl")),
      );
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać jednostki");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(unitId: string) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm("Usunąć jednostkę oraz powiązane zgłoszenia i projekty?")) return;
    try {
      await deleteUnit(token, unitId);
      setUnits((prev) => prev.filter((u) => u.id !== unitId));
      if (editingId === unitId) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć jednostki");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Ładowanie jednostek…</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="surface space-y-4 p-5">
        <p className="text-sm font-medium">Nowa jednostka</p>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Nazwa</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
            placeholder="np. Wydział Dróg"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Teren odpowiedzialności</span>
          <textarea
            required
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
            className="field min-h-[72px]"
            placeholder="np. dzielnica Śródmieście"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Kompetencje</span>
          <textarea
            required
            value={competencies}
            onChange={(e) => setCompetencies(e.target.value)}
            className="field min-h-[72px]"
            placeholder="np. drogi, oświetlenie"
          />
        </label>
        {error && !editingId && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy && !editingId ? "Zapisywanie…" : "Dodaj jednostkę"}
        </button>
      </form>

      <ul className="space-y-3">
        {units.length === 0 && (
          <li className="text-sm text-[var(--muted)]">Brak jednostek — dodaj pierwszą powyżej.</li>
        )}
        {units.map((unit) => (
          <li key={unit.id} className="surface p-4">
            {editingId === unit.id && draft ? (
              <form onSubmit={onSaveEdit} className="space-y-4">
                <p className="text-sm font-medium">Edycja jednostki</p>
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
                  <span className="mb-1.5 block text-[var(--muted)]">Teren odpowiedzialności</span>
                  <textarea
                    required
                    value={draft.territory}
                    onChange={(e) => setDraft({ ...draft, territory: e.target.value })}
                    className="field min-h-[72px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Kompetencje</span>
                  <textarea
                    required
                    value={draft.competencies}
                    onChange={(e) => setDraft({ ...draft, competencies: e.target.value })}
                    className="field min-h-[72px]"
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
                <div>
                  <p className="font-medium">{unit.name}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]">Teren:</span> {unit.territory}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]">Kompetencje:</span>{" "}
                    {unit.competencies}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(unit)}
                    className="btn-ghost text-sm"
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(unit.id)}
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
