import { useEffect, useState } from "react";

import {
  acceptProjectProposal,
  fetchProjectProposals,
  fetchUnits,
  rejectProjectProposal,
  type OrganizationalUnit,
  type ProjectProposal,
} from "@/lib/api";
import { hasSessionHint } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  nowe: "Nowe",
  zaakceptowane: "Zaakceptowane",
  odrzucone: "Odrzucone",
};

export function AdminProposalsView() {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [unitById, setUnitById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSessionHint()) return;
    Promise.all([fetchUnits(), fetchProjectProposals()])
      .then(([nextUnits, nextProposals]) => {
        setUnits(nextUnits);
        setProposals(nextProposals);
        const map: Record<string, string> = {};
        for (const proposal of nextProposals) {
          if (proposal.suggested_unit_id) {
            map[proposal.id] = proposal.suggested_unit_id;
          } else if (nextUnits[0]) {
            map[proposal.id] = nextUnits[0].id;
          }
        }
        setUnitById(map);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać propozycji"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onAccept(proposal: ProjectProposal) {
    const unitId = unitById[proposal.id];
    if (!hasSessionHint() || !unitId) return;
    setBusyId(proposal.id);
    setError(null);
    try {
      await acceptProjectProposal(proposal.id, { unit_id: unitId });
      setProposals((prev) =>
        prev.map((row) =>
          row.id === proposal.id
            ? {
                ...row,
                status: "zaakceptowane",
                suggested_unit_id: unitId,
                suggested_unit_name: units.find((u) => u.id === unitId)?.name ?? null,
              }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zaakceptować");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(proposal: ProjectProposal) {
    if (!hasSessionHint()) return;
    if (!window.confirm("Odrzucić tę propozycję?")) return;
    setBusyId(proposal.id);
    setError(null);
    try {
      const updated = await rejectProjectProposal(proposal.id);
      setProposals((prev) => prev.map((row) => (row.id === proposal.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się odrzucić");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie propozycji…</p>;
  }

  const open = proposals.filter((p) => p.status === "nowe");
  const done = proposals.filter((p) => p.status !== "nowe");

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Do przetworzenia</h2>
        {open.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Brak nowych propozycji z czatu. Opiekun zbiera je, gdy brakuje pasującego projektu.
          </p>
        )}
        <ul className="space-y-3">
          {open.map((proposal) => (
            <li key={proposal.id} className="surface space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{proposal.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Od: {proposal.author_name || proposal.author_email || `#${proposal.author_id}`}
                    {proposal.suggested_unit_name
                      ? ` · sugestia AI: ${proposal.suggested_unit_name}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-hover)]">
                  {STATUS_LABEL[proposal.status] ?? proposal.status}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
                {proposal.description}
              </p>
              {units.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Najpierw dodaj jednostkę organizacyjną.</p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block min-w-[14rem] flex-1 text-sm">
                    <span className="mb-1.5 block text-[var(--muted)]">Przydziel do jednostki</span>
                    <select
                      className="field"
                      value={unitById[proposal.id] ?? ""}
                      onChange={(e) =>
                        setUnitById((prev) => ({ ...prev, [proposal.id]: e.target.value }))
                      }
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === proposal.id}
                    onClick={() => void onAccept(proposal)}
                  >
                    Utwórz projekt
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === proposal.id}
                    onClick={() => void onReject(proposal)}
                  >
                    Odrzuć
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Historia</h2>
          <ul className="space-y-2">
            {done.map((proposal) => (
              <li key={proposal.id} className="surface p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{proposal.name}</p>
                  <span className="text-xs text-[var(--muted)]">
                    {STATUS_LABEL[proposal.status] ?? proposal.status}
                  </span>
                </div>
                <p className="mt-1 text-[var(--muted)]">
                  {proposal.suggested_unit_name ?? "bez jednostki"} ·{" "}
                  {proposal.author_email ?? `user #${proposal.author_id}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
