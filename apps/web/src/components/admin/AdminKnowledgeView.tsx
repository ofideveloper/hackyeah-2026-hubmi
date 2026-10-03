import { useEffect, useState, type FormEvent } from "react";

import {
  deleteKnowledgeResource,
  fetchKnowledge,
  refreshInnovationLibrary,
  saveKnowledgeResource,
  type KnowledgeArea,
  type KnowledgeResource,
  type KnowledgeResourceInput,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

const KIND_LABEL: Record<KnowledgeResource["kind"], string> = {
  wyzwanie: "Wyzwania (raporty, diagnozy)",
  material: "Materiały edukacyjne",
};

const EMPTY: KnowledgeResourceInput = {
  kind: "material",
  title: "",
  summary: "",
  format: "",
  url: "",
  category_id: null,
};

export function AdminKnowledgeView() {
  const [resources, setResources] = useState<KnowledgeResource[]>([]);
  const [areas, setAreas] = useState<KnowledgeArea[]>([]);
  const [innovationCount, setInnovationCount] = useState(0);
  const [form, setForm] = useState<KnowledgeResourceInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await fetchKnowledge();
    setResources(data.resources);
    setAreas(data.areas);
    setInnovationCount(data.innovations.length);
  }

  useEffect(() => {
    load()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać zasobów"),
      )
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function startEdit(resource: KnowledgeResource) {
    setError(null);
    setNotice(null);
    setEditingId(resource.id);
    setForm({
      kind: resource.kind,
      title: resource.title,
      summary: resource.summary,
      format: resource.format,
      url: resource.url ?? "",
      category_id: resource.category_id,
    });
    document.getElementById("knowledge-form")?.scrollIntoView({ block: "start" });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const saved = await saveKnowledgeResource(
        token,
        { ...form, url: form.url?.trim() || null },
        editingId,
      );
      setResources((prev) =>
        [...prev.filter((r) => r.id !== saved.id), saved].sort((a, b) =>
          a.title.localeCompare(b.title, "pl"),
        ),
      );
      setNotice(editingId ? "Zapisano zmiany." : "Dodano zasób — jest już widoczny w Zasobniku.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać zasobu");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(resource: KnowledgeResource) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Usunąć „${resource.title}” z Zasobnika wiedzy?`)) return;
    try {
      await deleteKnowledgeResource(token, resource.id);
      setResources((prev) => prev.filter((r) => r.id !== resource.id));
      if (editingId === resource.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć zasobu");
    }
  }

  async function onRefresh() {
    const token = getToken();
    if (!token) return;
    setError(null);
    setNotice(null);
    setRefreshing(true);
    try {
      const { added } = await refreshInnovationLibrary(token);
      await load();
      setNotice(
        added > 0
          ? `Dodano nowe innowacje z Biblioteki ROPS: ${added}.`
          : "Biblioteka jest aktualna — brak nowych innowacji.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się odświeżyć biblioteki");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Ładowanie zasobów…</p>;
  }

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name;

  return (
    <div className="space-y-8">
      <p aria-live="polite" className="text-sm font-medium text-[var(--accent-hover)]">
        {notice}
      </p>
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <section className="surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Biblioteka Innowacji Społecznych</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            W bazie: {innovationCount} innowacji. Odświeżenie dociąga nowe pozycje z serwisu ROPS.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={refreshing}
          onClick={() => void onRefresh()}
        >
          {refreshing ? "Sprawdzam…" : "Sprawdź nowe innowacje"}
        </button>
      </section>

      <form id="knowledge-form" onSubmit={onSubmit} className="surface space-y-4 p-5">
        <h2 className="text-base font-semibold">{editingId ? "Edycja zasobu" : "Nowy zasób"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Sekcja</span>
            <select
              className="field"
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as KnowledgeResource["kind"] })
              }
            >
              <option value="wyzwanie">{KIND_LABEL.wyzwanie}</option>
              <option value="material">{KIND_LABEL.material}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Obszar (opcjonalnie)</span>
            <select
              className="field"
              value={form.category_id ?? ""}
              onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
            >
              <option value="">Wszystkie obszary</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Tytuł</span>
          <input
            required
            minLength={2}
            maxLength={255}
            className="field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Forma</span>
            <input
              maxLength={40}
              className="field"
              placeholder="np. Raport, Film, Poradnik"
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">
              Link (https://…; link do YouTube osadzi film)
            </span>
            <input
              type="url"
              maxLength={1000}
              className="field"
              value={form.url ?? ""}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Opis (opcjonalnie)</span>
          <textarea
            maxLength={2000}
            className="field min-h-[88px]"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Zapisywanie…" : editingId ? "Zapisz zmiany" : "Dodaj zasób"}
          </button>
          {editingId && (
            <button type="button" className="btn-ghost" disabled={busy} onClick={resetForm}>
              Anuluj
            </button>
          )}
        </div>
      </form>

      {(["wyzwanie", "material"] as const).map((kind) => {
        const rows = resources.filter((r) => r.kind === kind);
        return (
          <section key={kind}>
            <h2 className="text-base font-semibold">
              {KIND_LABEL[kind]} ({rows.length})
            </h2>
            <ul className="mt-3 space-y-3">
              {rows.length === 0 && (
                <li className="text-sm text-[var(--muted)]">Brak pozycji w tej sekcji.</li>
              )}
              {rows.map((resource) => (
                <li
                  key={resource.id}
                  className="surface flex flex-wrap items-start justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{resource.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {[resource.format, areaName(resource.category_id) ?? "Wszystkie obszary"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {resource.url && (
                      <p className="mt-1 break-all text-sm text-[var(--muted)]">{resource.url}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      onClick={() => startEdit(resource)}
                    >
                      Edytuj<span className="sr-only">: {resource.title}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      onClick={() => void onDelete(resource)}
                    >
                      Usuń<span className="sr-only">: {resource.title}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
